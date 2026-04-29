import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const IndexScreen = lazy(() => import('./_screens/IndexScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <IndexScreen />
    </Suspense>
  );
}
