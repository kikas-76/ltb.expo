import { lazy, Suspense } from 'react';
import AdminScreenFallback from '@/components/admin/AdminScreenFallback';

const BookingsScreen = lazy(() => import('./_screens/BookingsScreen'));

export default function Page() {
  return (
    <Suspense fallback={<AdminScreenFallback />}>
      <BookingsScreen />
    </Suspense>
  );
}
