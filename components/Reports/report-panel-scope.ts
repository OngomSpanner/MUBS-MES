/** Optional faculty scope for ambassador (or other role-scoped) report panels. */
export type ReportPanelScopeProps = {
  scopeFaculty?: string | null;
  lockFaculty?: boolean;
  /** Limits data to the ambassador's assigned department/unit. */
  managedUnitId?: number | null;
};
