'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';

function LegacyReportsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'recruitment';

  useEffect(() => {
    if (tab === 'compliance') {
      router.replace('/ambassador?pg=tracking&tab=compliance');
    } else {
      router.replace(`/ambassador?pg=reporting&tab=${encodeURIComponent(tab)}`);
    }
  }, [router, tab]);

  return (
    <div className="d-flex justify-content-center align-items-center p-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Redirecting...</span>
      </div>
    </div>
  );
}

/** Legacy route — redirects to Phase 2 tracking/reporting URLs. */
export default function ReportsPage() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        }
      >
        <LegacyReportsRedirect />
      </Suspense>
    </Layout>
  );
}
