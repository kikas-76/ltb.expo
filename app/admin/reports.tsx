import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const ReportsScreen = lazy(() => import('./_screens/ReportsScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <ReportsScreen />
    </Suspense>
  );
}
