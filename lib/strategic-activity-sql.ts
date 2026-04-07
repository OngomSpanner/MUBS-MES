/**
 * Top-level strategic plan rows vs departmental-only tasks.
 * HOD departmental tasks: parent_id IS NULL, empty source, activity_type detailed.
 * MySQL: `source IS NOT NULL` is TRUE for '', so never rely on IS NOT NULL alone.
 */
export const SQL_TOP_STRATEGIC_MAIN_NO_ALIAS = `parent_id IS NULL AND COALESCE(TRIM(source), '') <> ''`;

export function sqlTopStrategicMain(alias: string): string {
  return `${alias}.parent_id IS NULL AND COALESCE(TRIM(${alias}.source), '') <> ''`;
}
