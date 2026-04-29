import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const AuditScreen = lazy(() => import('./_screens/AuditScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <AuditScreen />
    </Suspense>
  );
}
