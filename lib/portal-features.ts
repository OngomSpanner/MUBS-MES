export type PortalId = 'hod' | 'ambassador';

export type PortalFeatureDef = {
  key: string;
  portal: PortalId;
  group: string;
  label: string;
  description?: string;
  defaultEnabled: boolean;
  route?: { pg?: string; tab?: string };
};

export const PORTAL_FEATURE_CATALOG: PortalFeatureDef[] = [
  // ── HOD side menu ──
  { key: 'hod.menu.dashboard', portal: 'hod', group: 'Side menu', label: 'Dashboard', defaultEnabled: true, route: { pg: 'dashboard' } },
  { key: 'hod.menu.activities', portal: 'hod', group: 'Side menu', label: 'Strategic Activities', defaultEnabled: true, route: { pg: 'activities' } },
  { key: 'hod.menu.departmental-activities', portal: 'hod', group: 'Side menu', label: 'Departmental Activities', defaultEnabled: true, route: { pg: 'departmental-activities' } },
  { key: 'hod.menu.tasks', portal: 'hod', group: 'Side menu', label: 'Processes', defaultEnabled: true, route: { pg: 'tasks' } },
  { key: 'hod.menu.staff', portal: 'hod', group: 'Side menu', label: 'Staff & Warnings', defaultEnabled: true, route: { pg: 'staff' } },
  { key: 'hod.menu.evaluations', portal: 'hod', group: 'Side menu', label: 'Submissions & reviews', defaultEnabled: true, route: { pg: 'evaluations' } },
  { key: 'hod.menu.reports', portal: 'hod', group: 'Side menu', label: 'Performance & Reports', defaultEnabled: true, route: { pg: 'reports' } },

  // ── HOD evaluations sections ──
  { key: 'hod.section.evaluations.staff-reports', portal: 'hod', group: 'Submissions & reviews', label: 'Staff reports', defaultEnabled: true, route: { pg: 'evaluations', tab: 'staff-reports' } },
  { key: 'hod.section.evaluations.teaching', portal: 'hod', group: 'Submissions & reviews', label: 'Lecturer teaching data', defaultEnabled: true, route: { pg: 'evaluations', tab: 'teaching' } },
  { key: 'hod.section.evaluations.proposals', portal: 'hod', group: 'Submissions & reviews', label: 'Ambassador proposals', defaultEnabled: true, route: { pg: 'evaluations', tab: 'proposals' } },
  { key: 'hod.section.evaluations.questionnaire', portal: 'hod', group: 'Submissions & reviews', label: 'Performance indicators', defaultEnabled: true, route: { pg: 'evaluations', tab: 'questionnaire' } },
  { key: 'hod.section.evaluations.hr-reporting', portal: 'hod', group: 'Submissions & reviews', label: 'HR & workforce', defaultEnabled: true, route: { pg: 'evaluations', tab: 'hr-reporting' } },
  { key: 'hod.section.evaluations.enrollment', portal: 'hod', group: 'Submissions & reviews', label: 'Enrollment', defaultEnabled: true, route: { pg: 'evaluations', tab: 'enrollment' } },
  { key: 'hod.section.evaluations.results-framework', portal: 'hod', group: 'Submissions & reviews', label: 'Results framework', defaultEnabled: true, route: { pg: 'evaluations', tab: 'results-framework' } },

  // ── Ambassador side menu ──
  { key: 'ambassador.menu.tracking', portal: 'ambassador', group: 'Side menu', label: 'Tracking', defaultEnabled: true, route: { pg: 'tracking' } },
  { key: 'ambassador.menu.reporting', portal: 'ambassador', group: 'Side menu', label: 'Reporting', defaultEnabled: true, route: { pg: 'reporting' } },
  { key: 'ambassador.menu.propose-changes', portal: 'ambassador', group: 'Side menu', label: 'Propose Changes', defaultEnabled: true, route: { pg: 'propose-changes' } },

  // ── Ambassador tracking sections ──
  { key: 'ambassador.section.tracking.dashboard', portal: 'ambassador', group: 'Tracking', label: 'Dashboard', defaultEnabled: true, route: { pg: 'tracking', tab: 'dashboard' } },
  { key: 'ambassador.section.tracking.compliance', portal: 'ambassador', group: 'Tracking', label: 'Activity progress', defaultEnabled: true, route: { pg: 'tracking', tab: 'compliance' } },
  { key: 'ambassador.section.tracking.results', portal: 'ambassador', group: 'Tracking', label: 'Results Framework', defaultEnabled: true, route: { pg: 'tracking', tab: 'results' } },

  // ── Ambassador reporting sections ──
  { key: 'ambassador.section.reporting.data-collection', portal: 'ambassador', group: 'Reporting', label: 'Performance Indicators', defaultEnabled: true, route: { pg: 'reporting', tab: 'data-collection' } },
  { key: 'ambassador.section.reporting.recruitment', portal: 'ambassador', group: 'Reporting', label: 'Recruitment', defaultEnabled: true, route: { pg: 'reporting', tab: 'recruitment' } },
  { key: 'ambassador.section.reporting.benefits', portal: 'ambassador', group: 'Reporting', label: 'Benefits', defaultEnabled: true, route: { pg: 'reporting', tab: 'benefits' } },
  { key: 'ambassador.section.reporting.workforce-assessments', portal: 'ambassador', group: 'Reporting', label: 'Workforce', defaultEnabled: true, route: { pg: 'reporting', tab: 'workforce-assessments' } },
  { key: 'ambassador.section.reporting.employment-skill-status', portal: 'ambassador', group: 'Reporting', label: 'Skills', defaultEnabled: true, route: { pg: 'reporting', tab: 'employment-skill-status' } },
  { key: 'ambassador.section.reporting.staff-profiles', portal: 'ambassador', group: 'Reporting', label: 'Staff profiles', defaultEnabled: true, route: { pg: 'reporting', tab: 'staff-profiles' } },
  { key: 'ambassador.section.reporting.programme-enrollment', portal: 'ambassador', group: 'Reporting', label: 'Programmes', defaultEnabled: true, route: { pg: 'reporting', tab: 'programme-enrollment' } },
  { key: 'ambassador.section.reporting.course-unit-enrollment', portal: 'ambassador', group: 'Reporting', label: 'Course units', defaultEnabled: true, route: { pg: 'reporting', tab: 'course-unit-enrollment' } },
];

const FEATURE_BY_KEY = new Map(PORTAL_FEATURE_CATALOG.map((f) => [f.key, f]));

export const HOD_MENU_FEATURE_KEYS: Record<string, string> = {
  dashboard: 'hod.menu.dashboard',
  activities: 'hod.menu.activities',
  'departmental-activities': 'hod.menu.departmental-activities',
  tasks: 'hod.menu.tasks',
  staff: 'hod.menu.staff',
  evaluations: 'hod.menu.evaluations',
  reports: 'hod.menu.reports',
};

export const AMBASSADOR_MENU_FEATURE_KEYS: Record<string, string> = {
  tracking: 'ambassador.menu.tracking',
  reporting: 'ambassador.menu.reporting',
  'propose-changes': 'ambassador.menu.propose-changes',
};

export const HOD_EVALUATION_TAB_FEATURE_KEYS: Record<string, string> = {
  'staff-reports': 'hod.section.evaluations.staff-reports',
  teaching: 'hod.section.evaluations.teaching',
  proposals: 'hod.section.evaluations.proposals',
  questionnaire: 'hod.section.evaluations.questionnaire',
  'hr-reporting': 'hod.section.evaluations.hr-reporting',
  enrollment: 'hod.section.evaluations.enrollment',
  'results-framework': 'hod.section.evaluations.results-framework',
};

export const AMBASSADOR_TRACKING_TAB_FEATURE_KEYS: Record<string, string> = {
  dashboard: 'ambassador.section.tracking.dashboard',
  compliance: 'ambassador.section.tracking.compliance',
  results: 'ambassador.section.tracking.results',
};

export const AMBASSADOR_REPORTING_TAB_FEATURE_KEYS: Record<string, string> = {
  'data-collection': 'ambassador.section.reporting.data-collection',
  recruitment: 'ambassador.section.reporting.recruitment',
  benefits: 'ambassador.section.reporting.benefits',
  'workforce-assessments': 'ambassador.section.reporting.workforce-assessments',
  'employment-skill-status': 'ambassador.section.reporting.employment-skill-status',
  'staff-profiles': 'ambassador.section.reporting.staff-profiles',
  'programme-enrollment': 'ambassador.section.reporting.programme-enrollment',
  'course-unit-enrollment': 'ambassador.section.reporting.course-unit-enrollment',
};

export type PortalFeatureFlags = Record<string, boolean>;

export function getFeatureDef(key: string): PortalFeatureDef | undefined {
  return FEATURE_BY_KEY.get(key);
}

export function isFeatureEnabled(flags: PortalFeatureFlags, key: string): boolean {
  const def = FEATURE_BY_KEY.get(key);
  if (!def) return true;
  if (key in flags) return flags[key];
  return def.defaultEnabled;
}

export function featuresForPortal(portal: PortalId): PortalFeatureDef[] {
  return PORTAL_FEATURE_CATALOG.filter((f) => f.portal === portal);
}

export function isHodMenuEnabled(flags: PortalFeatureFlags, pg: string): boolean {
  const key = HOD_MENU_FEATURE_KEYS[pg];
  if (!key) return pg === 'dashboard' || pg === 'notifications';
  return isFeatureEnabled(flags, key);
}

export function isAmbassadorMenuEnabled(flags: PortalFeatureFlags, pg: string): boolean {
  if (pg === 'dashboard' || pg === 'reports') {
    return isFeatureEnabled(flags, 'ambassador.menu.tracking');
  }
  if (pg === 'notifications') return true;
  const key = AMBASSADOR_MENU_FEATURE_KEYS[pg];
  if (!key) return false;
  return isFeatureEnabled(flags, key);
}

export function firstEnabledHodMenuPg(flags: PortalFeatureFlags): string {
  for (const def of PORTAL_FEATURE_CATALOG) {
    if (def.portal !== 'hod' || !def.group.startsWith('Side menu')) continue;
    if (isFeatureEnabled(flags, def.key) && def.route?.pg) return def.route.pg;
  }
  return 'dashboard';
}

export function firstEnabledAmbassadorMenuPg(flags: PortalFeatureFlags): string {
  for (const def of PORTAL_FEATURE_CATALOG) {
    if (def.portal !== 'ambassador' || def.group !== 'Side menu') continue;
    if (isFeatureEnabled(flags, def.key) && def.route?.pg) return def.route.pg;
  }
  return 'tracking';
}

export function firstEnabledHodEvaluationTab(flags: PortalFeatureFlags): string {
  for (const def of PORTAL_FEATURE_CATALOG) {
    if (!def.key.startsWith('hod.section.evaluations.')) continue;
    if (isFeatureEnabled(flags, def.key) && def.route?.tab) return def.route.tab;
  }
  return 'staff-reports';
}

export function isHodEvaluationTabEnabled(flags: PortalFeatureFlags, tab: string): boolean {
  const key = HOD_EVALUATION_TAB_FEATURE_KEYS[tab];
  if (!key) return false;
  return isFeatureEnabled(flags, key);
}

export function isAmbassadorTrackingTabEnabled(flags: PortalFeatureFlags, tab: string): boolean {
  const normalized = tab === 'milestones' || tab === 'alerts' ? 'compliance' : tab;
  const key = AMBASSADOR_TRACKING_TAB_FEATURE_KEYS[normalized];
  if (!key) return normalized === 'dashboard';
  return isFeatureEnabled(flags, key);
}

export function isAmbassadorReportingTabEnabled(flags: PortalFeatureFlags, tab: string): boolean {
  const key = AMBASSADOR_REPORTING_TAB_FEATURE_KEYS[tab];
  if (!key) return tab === 'data-collection';
  return isFeatureEnabled(flags, key);
}

export function firstEnabledAmbassadorTrackingTab(flags: PortalFeatureFlags): string {
  for (const tab of ['dashboard', 'compliance', 'results']) {
    if (isAmbassadorTrackingTabEnabled(flags, tab)) return tab;
  }
  return 'dashboard';
}

export function firstEnabledAmbassadorReportingTab(flags: PortalFeatureFlags): string {
  const order = Object.keys(AMBASSADOR_REPORTING_TAB_FEATURE_KEYS);
  for (const tab of order) {
    if (isAmbassadorReportingTabEnabled(flags, tab)) return tab;
  }
  return 'data-collection';
}

export type PortalFeatureAdminRow = PortalFeatureDef & {
  enabled: boolean;
  updated_at: string | null;
  updated_by: number | null;
};

export function groupFeaturesByPortalAndGroup(
  features: PortalFeatureAdminRow[],
  portal: PortalId,
): Map<string, PortalFeatureAdminRow[]> {
  const grouped = new Map<string, PortalFeatureAdminRow[]>();
  for (const f of features.filter((x) => x.portal === portal)) {
    const list = grouped.get(f.group) ?? [];
    list.push(f);
    grouped.set(f.group, list);
  }
  return grouped;
}

export function resolveAmbassadorPgTab(
  flags: PortalFeatureFlags,
  pg: string,
  tab: string | undefined,
): { pg: string; tab?: string } {
  let resolvedPg = pg;
  if (!isAmbassadorMenuEnabled(flags, pg)) {
    resolvedPg = firstEnabledAmbassadorMenuPg(flags);
  }

  if (resolvedPg === 'tracking') {
    const resolvedTab = tab && isAmbassadorTrackingTabEnabled(flags, tab)
      ? (tab === 'milestones' || tab === 'alerts' ? 'compliance' : tab)
      : firstEnabledAmbassadorTrackingTab(flags);
    return { pg: resolvedPg, tab: resolvedTab };
  }

  if (resolvedPg === 'reporting') {
    const resolvedTab = tab && isAmbassadorReportingTabEnabled(flags, tab)
      ? tab
      : firstEnabledAmbassadorReportingTab(flags);
    return { pg: resolvedPg, tab: resolvedTab };
  }

  return { pg: resolvedPg };
}
