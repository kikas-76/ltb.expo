import { useCallback } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { setAuthReturnPath } from '@/lib/authReturn';

/**
 * Pour les actions réservées aux comptes (réserver, favori, contacter…).
 * Renvoie une fonction : vrai si l'utilisateur est connecté ; sinon elle retient
 * l'écran courant (ou `returnTo`), ouvre la connexion et renvoie faux.
 */
export function useRequireAuth() {
  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return useCallback(
    (returnTo?: string): boolean => {
      if (session) return true;
      setAuthReturnPath(returnTo ?? pathname);
      router.push('/login');
      return false;
    },
    [session, pathname, router],
  );
}
