import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const DisputesScreen = lazy(() => import('./_screens/DisputesScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <DisputesScreen />
    </Suspense>
  );
}
