import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const UsersScreen = lazy(() => import('./_screens/UsersScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <UsersScreen />
    </Suspense>
  );
}
