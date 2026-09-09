import EmptyState from '@/components/EmptyState';

interface Props {
  onRetry: () => void;
  compact?: boolean;
  title?: string;
}

/** État « impossible de charger » avec bouton Réessayer (panne réseau, serveur injoignable). */
export default function LoadError({ onRetry, compact, title }: Props) {
  return (
    <EmptyState
      illustration="search"
      title={title ?? 'Impossible de charger'}
      subtitle="Vérifiez votre connexion et réessayez."
      actionLabel="Réessayer"
      onAction={onRetry}
      compact={compact}
    />
  );
}
