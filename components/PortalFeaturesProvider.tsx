'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isFeatureEnabled,
  type PortalFeatureFlags,
} from '@/lib/portal-features';

type PortalFeaturesContextValue = {
  flags: PortalFeatureFlags;
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => Promise<void>;
};

const PortalFeaturesContext = createContext<PortalFeaturesContextValue | null>(null);

export function PortalFeaturesProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<PortalFeatureFlags>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/portal-features', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags ?? {});
      }
    } catch (e) {
      console.error('Failed to load portal features', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isEnabled = useCallback(
    (key: string) => isFeatureEnabled(flags, key),
    [flags],
  );

  const value = useMemo(
    () => ({ flags, loading, isEnabled, refresh }),
    [flags, loading, isEnabled, refresh],
  );

  return (
    <PortalFeaturesContext.Provider value={value}>
      {children}
    </PortalFeaturesContext.Provider>
  );
}

export function usePortalFeatures(): PortalFeaturesContextValue {
  const ctx = useContext(PortalFeaturesContext);
  if (!ctx) {
    return {
      flags: {},
      loading: false,
      isEnabled: () => true,
      refresh: async () => {},
    };
  }
  return ctx;
}
