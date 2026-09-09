import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { registerForPushNotifications, unregisterPushToken } from '@/lib/pushNotifications';
import { readCache, writeCache } from '@/lib/queryCache';

interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  photo_url: string | null;
  phone_number: string | null;
  location_data: { address: string; lat: number | null; lng: number | null } | null;
  is_pro: boolean;
  bio: string | null;
  role: string | null;
  onboarding_completed: boolean;
  created_at?: string;
  account_status?: string | null;
  banned_until?: string | null;
  ban_reason?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null; emailConflict?: string }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    // Profil en cache local → disponible tout de suite : le guard de navigation
    // n'attend plus le réseau au démarrage. Le RPC rafraîchit juste derrière.
    const cached = await readCache<Profile>(`profile:${userId}`);
    if (cached) {
      setProfile((current) => current ?? cached);
      setProfileLoading(false);
    }
    // Direct SELECT on profiles is column-restricted for authenticated users
    // (email, phone_number, role, onboarding_completed are revoked). The
    // SECURITY DEFINER RPC reads auth.uid() server-side and returns the
    // caller's full row. The RPC keys on the JWT, not on the param.
    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) {
      // Erreur réseau : on garde le profil connu plutôt que de vider l'UI.
      if (!cached) setProfile(null);
    } else {
      const row = Array.isArray(data) ? data[0] : data;
      setProfile(row ?? null);
      if (row) writeCache(`profile:${userId}`, row);
    }
    setProfileLoading(false);
  };

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await fetchProfile(currentUser.id);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      // Web ouvert dans la WebView de l'app (onboarding Stripe embarqué) : l'app
      // passe sa session dans le fragment d'URL, jamais envoyé au serveur, puis
      // on l'efface de la barre d'adresse. Gardé par handoff=1 pour ne pas
      // interférer avec les liens magiques Supabase (auth-callback, etc.).
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const at = params.get('access_token');
        const rt = params.get('refresh_token');
        if (params.get('handoff') === '1' && at && rt) {
          try {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          } catch {}
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setLoading(false);
    };
    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await fetchProfile(s.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (user?.id) {
      registerForPushNotifications();
    }
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null; emailConflict?: string }> => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/auth-callback`
        : 'louetonbien://';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) return { error: error.message };
      if (!data.url) return { error: 'Impossible de lancer le flux Google.' };

      if (Platform.OS !== 'web') {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const url = result.url;
          const fragment = url.split('#')[1] ?? '';
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const errorCode = params.get('error_code');
          const errorDesc = params.get('error_description') ?? '';

          if (errorCode === 'provider_email_needs_verification' || errorDesc.includes('already registered')) {
            const emailParam = params.get('email') ?? '';
            return { error: null, emailConflict: emailParam };
          }

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) return { error: sessionError.message };

            if (sessionData.user) {
              const identities = sessionData.user.identities ?? [];
              const hasEmailProvider = identities.some(id => id.provider === 'email');
              const hasGoogleProvider = identities.some(id => id.provider === 'google');
              if (hasEmailProvider && !hasGoogleProvider) {
                return { error: null, emailConflict: sessionData.user.email ?? '' };
              }
            }
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          return { error: null };
        }
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const identities = userData.user.identities ?? [];
          const hasEmailProvider = identities.some(id => id.provider === 'email');
          const hasGoogleProvider = identities.some(id => id.provider === 'google');
          if (hasEmailProvider && !hasGoogleProvider) {
            return { error: null, emailConflict: userData.user.email ?? '' };
          }
        }
      }

      return { error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la connexion Google.';
      return { error: message };
    }
  };

  const signInWithApple = async (): Promise<{ error: string | null }> => {
    if (Platform.OS !== 'ios') {
      return { error: "La connexion avec Apple n'est disponible que sur iPhone et iPad." };
    }
    try {
      // require dynamique : le module natif n'existe pas sur web/Android
      const AppleAuthentication = require('expo-apple-authentication');
      const Crypto = require('expo-crypto');
      // Nonce anti-rejeu : Apple signe le SHA-256, Supabase vérifie avec la valeur brute.
      const rawNonce: string = Crypto.randomUUID();
      const hashedNonce: string = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return { error: "Apple n'a pas renvoyé de jeton d'identité. Réessayez." };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) return { error: error.message };

      // Apple ne transmet le nom qu'à la première autorisation : on le garde
      // dans les métadonnées pour pré-remplir l'onboarding.
      const given = credential.fullName?.givenName ?? '';
      const family = credential.fullName?.familyName ?? '';
      if (given || family) {
        supabase.auth
          .updateUser({ data: { full_name: `${given} ${family}`.trim(), given_name: given || undefined, family_name: family || undefined } })
          .catch(() => {});
      }

      // Le refresh token Apple est conservé chiffré côté serveur pour être
      // révoqué à la suppression du compte (exigence App Store). Best effort.
      if (credential.authorizationCode) {
        supabase.functions
          .invoke('apple-token-exchange', { body: { code: credential.authorizationCode } })
          .catch(() => {});
      }

      return { error: null };
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        return { error: null };
      }
      const message = e instanceof Error ? e.message : 'Erreur lors de la connexion Apple.';
      return { error: message };
    }
  };

  const signOut = async () => {
    await unregisterPushToken();
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileLoading, signIn, signInWithGoogle, signInWithApple, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
