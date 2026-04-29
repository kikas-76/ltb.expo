import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const TransactionsScreen = lazy(() => import('./_screens/TransactionsScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <TransactionsScreen />
    </Suspense>
  );
}
