'use client';

import Layout from '@/components/Layout';
import ActionTrackerPanel from '@/components/ActionTracker/ActionTrackerPanel';

export default function AdminActionTrackerView() {
  return (
    <Layout>
      <ActionTrackerPanel portal="admin" />
    </Layout>
  );
}
