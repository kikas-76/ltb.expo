import { useRouter } from 'expo-router';
import EmptyState from '@/components/EmptyState';

interface CategoryEmptyStateProps {
  categoryName: string;
}

export default function CategoryEmptyState({ categoryName }: CategoryEmptyStateProps) {
  const router = useRouter();
  return (
    <EmptyState
      illustration="search"
      title={`Rien encore dans « ${categoryName} »`}
      subtitle="Soyez le premier à déposer une annonce dans cette catégorie."
      actionLabel="Déposer une annonce"
      onAction={() => router.push('/create-listing')}
    />
  );
}
