"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Layout from '../../components/Layout';
import CommDashboard from './views/CommDashboard';
import CommPropose from './views/CommPropose';
import CommAllProposals from './views/CommAllProposals';
import CommPending from './views/CommPending';
import CommApproved from './views/CommApproved';
import CommRejected from './views/CommRejected';
import CommNotifications from './views/CommNotifications';
import './CommStyles.css';

function CommContent() {
  const searchParams = useSearchParams();
  const pg = searchParams.get('pg') || 'dashboard';

  switch (pg) {
    case 'dashboard':
      return <CommDashboard />;
    case 'propose':
      return <CommPropose />;
    case 'my-proposals':
      return <CommAllProposals showOnlyMine />;
    case 'pending':
      return <CommPending />;
    case 'approved':
      return <CommApproved />;
    case 'rejected':
      return <CommRejected />;
    case 'notifications':
      return <CommNotifications />;
    default:
      return <CommDashboard />;
  }
}

export default function CommPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="p-4">Loading Committee Dashboard...</div>}>
        <CommContent />
      </Suspense>
    </Layout>
  );
}