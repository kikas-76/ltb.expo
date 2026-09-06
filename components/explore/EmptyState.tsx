import { useRouter } from 'expo-router';
import EmptyState from '@/components/EmptyState';

export default function HomeEmptyState() {
  const router = useRouter();
  return (
    <EmptyState
      illustration="box"
      title="Pas encore d'objets près de chez vous"
      subtitle="Soyez le premier à publier : vos voisins n'attendent que ça."
      actionLabel="Publier un objet"
      onAction={() => router.push('/create-listing')}
    />
  );
}
