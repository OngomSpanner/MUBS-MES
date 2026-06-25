import { query } from '@/lib/db';
import {
  PORTAL_FEATURE_CATALOG,
  type PortalFeatureAdminRow,
  type PortalFeatureFlags,
} from '@/lib/portal-features';

export type { PortalFeatureAdminRow } from '@/lib/portal-features';

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;

async function ensurePortalFeatureSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await query({
        query: `
          CREATE TABLE IF NOT EXISTS portal_feature_flags (
            feature_key VARCHAR(128) NOT NULL PRIMARY KEY,
            enabled TINYINT(1) NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by INT NULL,
            CONSTRAINT fk_pff_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
      });
      schemaEnsured = true;
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

export async function getMergedPortalFlags(): Promise<PortalFeatureFlags> {
  await ensurePortalFeatureSchema();

  const rows = (await query({
    query: 'SELECT feature_key, enabled FROM portal_feature_flags',
  })) as { feature_key: string; enabled: number }[];

  const overrides = new Map(rows.map((r) => [r.feature_key, Boolean(r.enabled)]));

  const flags: PortalFeatureFlags = {};
  for (const def of PORTAL_FEATURE_CATALOG) {
    flags[def.key] = overrides.has(def.key) ? overrides.get(def.key)! : def.defaultEnabled;
  }
  return flags;
}

export async function getAdminPortalFeatures(): Promise<PortalFeatureAdminRow[]> {
  await ensurePortalFeatureSchema();

  const rows = (await query({
    query: 'SELECT feature_key, enabled, updated_at, updated_by FROM portal_feature_flags',
  })) as { feature_key: string; enabled: number; updated_at: Date | string | null; updated_by: number | null }[];

  const overrides = new Map(
    rows.map((r) => [
      r.feature_key,
      {
        enabled: Boolean(r.enabled),
        updated_at: r.updated_at ? String(r.updated_at) : null,
        updated_by: r.updated_by,
      },
    ]),
  );

  return PORTAL_FEATURE_CATALOG.map((def) => {
    const row = overrides.get(def.key);
    return {
      ...def,
      enabled: row ? row.enabled : def.defaultEnabled,
      updated_at: row?.updated_at ?? null,
      updated_by: row?.updated_by ?? null,
    };
  });
}

export async function updatePortalFeatureFlags(
  updates: Record<string, boolean>,
  userId: number,
): Promise<void> {
  await ensurePortalFeatureSchema();

  const validKeys = new Set(PORTAL_FEATURE_CATALOG.map((f) => f.key));

  for (const [key, enabled] of Object.entries(updates)) {
    if (!validKeys.has(key)) continue;
    await query({
      query: `
        INSERT INTO portal_feature_flags (feature_key, enabled, updated_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_by = VALUES(updated_by)
      `,
      values: [key, enabled ? 1 : 0, userId],
    });
  }
}
