import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const AnalyticsScreen = lazy(() => import('./_screens/AnalyticsScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <AnalyticsScreen />
    </Suspense>
  );
}
