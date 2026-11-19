// Règles de mot de passe imposées par Supabase Auth (réglages du projet) :
// 6 caractères minimum, avec au moins une minuscule, une majuscule et un chiffre.
// Vérifiées avant l'envoi pour afficher un message clair en français (Supabase
// répond en anglais, code weak_password).

export const PASSWORD_HINT = '6 caractères min., dont une majuscule et un chiffre';

export function passwordProblem(password: string): string | null {
  if (password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre.';
  }
  return null;
}
