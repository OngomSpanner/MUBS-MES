/** Optional faculty scope for ambassador (or other role-scoped) report panels. */
export type ReportPanelScopeProps = {
  scopeFaculty?: string | null;
  lockFaculty?: boolean;
  /** Limits data to departments under this faculty/office unit (ambassador). */
  managedUnitId?: number | null;
};
