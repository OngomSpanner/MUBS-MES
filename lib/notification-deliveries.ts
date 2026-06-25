import { query } from '@/lib/db';

export type NotificationEventType =
  | 'indicator_submitted'
  | 'indicator_approved'
  | 'indicator_returned';

export type NotificationChannel = 'in_app' | 'email';
export type NotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';

export type IndicatorNotificationPayload = {
  eventType: NotificationEventType;
  indicatorId: number;
  departmentId: number;
  submittedByUserId?: number;
  reviewerUserId?: number;
  reviewAction?: 'approve' | 'return';
  reviewComment?: string | null;
  ambassadorName?: string;
  recipientFullName?: string;
  reviewerName?: string;
  title: string;
  message: string;
  notificationType: 'info' | 'success' | 'warning' | 'danger';
  actionUrl: string;
  emailSubject?: string;
};

export type NotificationDeliveryAdminRow = {
  id: number;
  event_type: NotificationEventType;
  indicator_id: number;
  department_id: number;
  recipient_user_id: number;
  recipient_email: string | null;
  recipient_name: string | null;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  error_message: string | null;
  in_app_notification_id: number | null;
  email_subject: string | null;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
  last_retry_at: string | null;
  indicator_text: string | null;
  department_name: string | null;
};

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;

export async function ensureNotificationDeliverySchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await query({
        query: `
          CREATE TABLE IF NOT EXISTS notification_deliveries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            event_type VARCHAR(64) NOT NULL,
            indicator_id INT NOT NULL,
            department_id INT NOT NULL,
            recipient_user_id INT NOT NULL,
            recipient_email VARCHAR(255) NULL,
            channel ENUM('in_app', 'email') NOT NULL,
            status ENUM('sent', 'failed', 'skipped') NOT NULL,
            error_message TEXT NULL,
            in_app_notification_id INT NULL,
            email_subject VARCHAR(255) NULL,
            payload_json JSON NOT NULL,
            retry_count INT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP NULL,
            last_retry_at TIMESTAMP NULL,
            PRIMARY KEY (id),
            KEY idx_nd_status (status),
            KEY idx_nd_event (event_type),
            KEY idx_nd_indicator (indicator_id, department_id),
            KEY idx_nd_recipient (recipient_user_id),
            KEY idx_nd_created (created_at),
            CONSTRAINT fk_nd_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
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

export async function recordNotificationDelivery(args: {
  eventType: NotificationEventType;
  indicatorId: number;
  departmentId: number;
  recipientUserId: number;
  recipientEmail: string | null;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  errorMessage?: string | null;
  inAppNotificationId?: number | null;
  emailSubject?: string | null;
  payload: IndicatorNotificationPayload;
}): Promise<number> {
  await ensureNotificationDeliverySchema();

  const result = (await query({
    query: `
      INSERT INTO notification_deliveries (
        event_type, indicator_id, department_id, recipient_user_id, recipient_email,
        channel, status, error_message, in_app_notification_id, email_subject,
        payload_json, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'sent', NOW(), NULL))
    `,
    values: [
      args.eventType,
      args.indicatorId,
      args.departmentId,
      args.recipientUserId,
      args.recipientEmail,
      args.channel,
      args.status,
      args.errorMessage ?? null,
      args.inAppNotificationId ?? null,
      args.emailSubject ?? null,
      JSON.stringify(args.payload),
      args.status,
    ],
  })) as { insertId?: number };

  return Number(result?.insertId ?? 0);
}

export async function listNotificationDeliveries(filters: {
  status?: NotificationDeliveryStatus | 'all';
  limit?: number;
  offset?: number;
}): Promise<{ deliveries: NotificationDeliveryAdminRow[]; total: number }> {
  await ensureNotificationDeliverySchema();

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const values: (string | number)[] = [];
  let where = 'WHERE 1=1';

  if (filters.status && filters.status !== 'all') {
    where += ' AND nd.status = ?';
    values.push(filters.status);
  }

  const countRows = (await query({
    query: `SELECT COUNT(*) AS c FROM notification_deliveries nd ${where}`,
    values,
  })) as { c: number }[];

  const rows = (await query({
    query: `
      SELECT nd.id, nd.event_type, nd.indicator_id, nd.department_id,
             nd.recipient_user_id, nd.recipient_email, nd.channel, nd.status,
             nd.error_message, nd.in_app_notification_id, nd.email_subject,
             nd.retry_count, nd.created_at, nd.sent_at, nd.last_retry_at,
             u.full_name AS recipient_name,
             i.indicator_text,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
      FROM notification_deliveries nd
      LEFT JOIN users u ON u.id = nd.recipient_user_id
      LEFT JOIN q_indicators i ON i.id = nd.indicator_id
      LEFT JOIN departments d ON d.id = nd.department_id
      ${where}
      ORDER BY nd.created_at DESC, nd.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    values,
  })) as NotificationDeliveryAdminRow[];

  return { deliveries: rows, total: Number(countRows[0]?.c ?? 0) };
}

export async function getNotificationDeliveryById(
  id: number
): Promise<(NotificationDeliveryAdminRow & { payload_json: string }) | null> {
  await ensureNotificationDeliverySchema();
  const rows = (await query({
    query: `
      SELECT nd.*, u.full_name AS recipient_name,
             i.indicator_text,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department_name
      FROM notification_deliveries nd
      LEFT JOIN users u ON u.id = nd.recipient_user_id
      LEFT JOIN q_indicators i ON i.id = nd.indicator_id
      LEFT JOIN departments d ON d.id = nd.department_id
      WHERE nd.id = ?
      LIMIT 1
    `,
    values: [id],
  })) as (NotificationDeliveryAdminRow & { payload_json: string })[];

  return rows[0] ?? null;
}

export async function updateNotificationDeliveryAfterRetry(
  id: number,
  args: {
    status: NotificationDeliveryStatus;
    errorMessage?: string | null;
    inAppNotificationId?: number | null;
  }
): Promise<void> {
  await query({
    query: `
      UPDATE notification_deliveries
      SET status = ?,
          error_message = ?,
          in_app_notification_id = COALESCE(?, in_app_notification_id),
          retry_count = retry_count + 1,
          last_retry_at = NOW(),
          sent_at = IF(? = 'sent', NOW(), sent_at)
      WHERE id = ?
    `,
    values: [
      args.status,
      args.errorMessage ?? null,
      args.inAppNotificationId ?? null,
      args.status,
      id,
    ],
  });
}

export function eventTypeLabel(eventType: NotificationEventType): string {
  switch (eventType) {
    case 'indicator_submitted':
      return 'Indicator submitted';
    case 'indicator_approved':
      return 'Indicator approved';
    case 'indicator_returned':
      return 'Indicator returned';
    default:
      return eventType;
  }
}
