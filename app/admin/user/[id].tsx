import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const UserDetailScreen = lazy(() => import('./_screens/UserDetailScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <UserDetailScreen />
    </Suspense>
  );
}
