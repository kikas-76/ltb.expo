import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  photo_url: string | null;
  phone_number: string | null;
  location_data: { address: string; lat: number | null; lng: number | null } | null;
  is_pro: boolean;
  bio: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null; emailConflict?: string }>;
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
    const { data } = await supabase
      .from('profiles')
      .select('id, email, username, photo_url, phone_number, location_data, is_pro, bio')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
    setProfileLoading(false);
  };

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await fetchProfile(currentUser.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setLoading(false);
    });

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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null; emailConflict?: string }> => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/`
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
    } catch (e: any) {
      return { error: e?.message ?? 'Erreur lors de la connexion Google.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileLoading, signIn, signInWithGoogle, signOut, refreshProfile }}>
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
