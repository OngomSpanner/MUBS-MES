'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import axios from 'axios';
import {
  groupFeaturesByPortalAndGroup,
  type PortalFeatureAdminRow,
  type PortalId,
} from '@/lib/portal-features';
import { usePortalFeatures } from '@/components/PortalFeaturesProvider';
import NotificationDeliveriesPanel from './NotificationDeliveriesPanel';

type SettingsTab = PortalId | 'notifications';

function FeatureToggleGroup({
  title,
  features,
  draft,
  onToggle,
}: {
  title: string;
  features: PortalFeatureAdminRow[];
  draft: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  if (features.length === 0) return null;

  return (
    <div className="border rounded-3 p-3 mb-3 bg-white">
      <h6 className="fw-bold text-primary small mb-3">{title}</h6>
      <div className="d-flex flex-column gap-2">
        {features.map((f) => {
          const enabled = draft[f.key] ?? f.enabled;
          return (
            <div
              key={f.key}
              className="d-flex align-items-start justify-content-between gap-3 py-2 border-bottom border-light"
            >
              <div className="min-w-0">
                <div className="fw-semibold small">{f.label}</div>
                {f.description ? (
                  <div className="text-muted" style={{ fontSize: '.75rem' }}>{f.description}</div>
                ) : null}
              </div>
              <div className="form-check form-switch flex-shrink-0 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`feature-${f.key}`}
                  checked={enabled}
                  onChange={(e) => onToggle(f.key, e.target.checked)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PortalPanel({
  portal,
  label,
  features,
  draft,
  onToggle,
  onSetAll,
}: {
  portal: PortalId;
  label: string;
  features: PortalFeatureAdminRow[];
  draft: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
  onSetAll: (portal: PortalId, enabled: boolean) => void;
}) {
  const grouped = useMemo(() => groupFeaturesByPortalAndGroup(features, portal), [features, portal]);

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h5 className="fw-bold mb-0">{label}</h5>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onSetAll(portal, true)}>
            Enable all
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onSetAll(portal, false)}>
            Disable all
          </button>
        </div>
      </div>
      <p className="text-muted small mb-3">
        Disabled items are hidden from the side menu and section tabs. Direct links redirect to the first available section.
      </p>
      {Array.from(grouped.entries()).map(([group, items]) => (
        <FeatureToggleGroup
          key={group}
          title={group}
          features={items}
          draft={draft}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export default function PortalSettingsView() {
  const router = useRouter();
  const { refresh: refreshGlobalFlags } = usePortalFeatures();
  const [features, setFeatures] = useState<PortalFeatureAdminRow[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('hod');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await axios.get('/api/admin/portal-features');
      const list = res.data.features as PortalFeatureAdminRow[];
      setFeatures(list);
      const initial: Record<string, boolean> = {};
      for (const f of list) initial[f.key] = f.enabled;
      setDraft(initial);
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        router.replace('/admin?pg=dashboard');
        return;
      }
      setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Failed to load settings' : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    return features.some((f) => (draft[f.key] ?? f.enabled) !== f.enabled);
  }, [features, draft]);

  const handleToggle = (key: string, enabled: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: enabled }));
    setSuccess(false);
  };

  const handleSetAll = (portal: PortalId, enabled: boolean) => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const f of features) {
        if (f.portal === portal) next[f.key] = enabled;
      }
      return next;
    });
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    setSuccess(false);
    try {
      const updates: Record<string, boolean> = {};
      for (const f of features) {
        const value = draft[f.key] ?? f.enabled;
        if (value !== f.enabled) updates[f.key] = value;
      }
      if (Object.keys(updates).length === 0) return;

      const res = await axios.put('/api/admin/portal-features', { updates });
      const list = res.data.features as PortalFeatureAdminRow[];
      setFeatures(list);
      const next: Record<string, boolean> = {};
      for (const f of list) next[f.key] = f.enabled;
      setDraft(next);
      setSuccess(true);
      await refreshGlobalFlags();
    } catch (e: unknown) {
      setErr(axios.isAxiosError(e) ? e.response?.data?.message ?? 'Save failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="page-section active-page">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Settings</h4>
            <p className="text-muted small mb-0">
              Portal visibility, and notification delivery log with resend for performance indicators.
            </p>
          </div>
          {activeTab !== 'notifications' ? (
          <button
            type="button"
            className="btn btn-primary fw-bold"
            disabled={!dirty || saving || loading}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          ) : null}
        </div>

        {err && <div className="alert alert-danger py-2 small">{err}</div>}
        {success && <div className="alert alert-success py-2 small">Settings saved. Users will see changes on their next page load.</div>}

        {loading && activeTab !== 'notifications' ? (
          <div className="d-flex justify-content-center p-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <>
            <ul className="nav nav-pills gap-2 mb-4">
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link fw-bold ${activeTab === 'hod' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hod')}
                >
                  HOD portal
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link fw-bold ${activeTab === 'ambassador' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ambassador')}
                >
                  Ambassador portal
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link fw-bold ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                >
                  Notifications
                </button>
              </li>
            </ul>

            {activeTab === 'notifications' ? (
              <NotificationDeliveriesPanel />
            ) : activeTab === 'hod' ? (
              <PortalPanel
                portal="hod"
                label="Head of Department (HOD)"
                features={features}
                draft={draft}
                onToggle={handleToggle}
                onSetAll={handleSetAll}
              />
            ) : (
              <PortalPanel
                portal="ambassador"
                label="Ambassador"
                features={features}
                draft={draft}
                onToggle={handleToggle}
                onSetAll={handleSetAll}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
