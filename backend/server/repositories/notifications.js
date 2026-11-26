import { appDB } from '../db.js';
import { sendTelegramMessage } from '../mailer.js';

export async function createNotification({
  recipientEmpId,
  requestId,
  type,
  title,
  message,
  linkUrl,
  sendTelegram = false,
}) {
  await appDB.query(
    `INSERT INTO itreq_notifications
       (recipient_emp_id, request_id, type, title, message, link_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [recipientEmpId, requestId || null, type || null, title || null, message, linkUrl || null],
  );
  if (sendTelegram) {
    sendTelegramMessage({
      text: formatTelegramNotification({ recipientEmpId, type, title, message, linkUrl }),
    }).catch((err) => console.warn('[telegram] notify error:', err.message));
  }
}

function formatTelegramNotification({ recipientEmpId, type, title, message, linkUrl }) {
  const publicBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const fullLink = linkUrl && publicBase && linkUrl.startsWith('/')
    ? `${publicBase}${linkUrl}`
    : linkUrl;
  return [
    'IT Request',
    title || type || 'แจ้งเตือน',
    recipientEmpId ? `ผู้รับ: ${recipientEmpId}` : '',
    message || '',
    fullLink ? `เปิดดู: ${fullLink}` : '',
  ].filter(Boolean).join('\n');
}

export async function listForRecipient(empId, { unreadOnly = false, limit = 30 } = {}) {
  const [rows] = await appDB.query(
    `SELECT id, request_id, type, title, message, link_url, is_read, read_at, created_at
       FROM itreq_notifications
      WHERE recipient_emp_id = ?
        ${unreadOnly ? 'AND is_read = 0' : ''}
      ORDER BY created_at DESC
      LIMIT ?`,
    [empId, Number(limit)],
  );
  return rows;
}

export async function countUnread(empId) {
  const [[row]] = await appDB.query(
    `SELECT COUNT(*) AS c FROM itreq_notifications WHERE recipient_emp_id = ? AND is_read = 0`,
    [empId],
  );
  return row.c;
}

export async function markRead(id, empId) {
  await appDB.query(
    `UPDATE itreq_notifications SET is_read = 1, read_at = NOW()
      WHERE id = ? AND recipient_emp_id = ?`,
    [id, empId],
  );
}

export async function markAllRead(empId) {
  await appDB.query(
    `UPDATE itreq_notifications SET is_read = 1, read_at = NOW()
      WHERE recipient_emp_id = ? AND is_read = 0`,
    [empId],
  );
}
