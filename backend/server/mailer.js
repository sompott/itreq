import nodemailer from 'nodemailer';
import { smtpConfig, smtpEnabled, telegramConfig, telegramEnabled, config } from './config.js';

let transporter = null;
function getTransporter() {
  if (!smtpEnabled) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.user
      ? { user: smtpConfig.user, pass: smtpConfig.pass }
      : undefined,
  });
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail mock] → ${to} | ${subject}`);
    return { mocked: true, to };
  }
  const result = await t.sendMail({
    from: smtpConfig.from || smtpConfig.user,
    to,
    subject,
    html,
    text,
  });
  return { mocked: false, messageId: result.messageId, to };
}

export async function sendTelegramMessage({ text }) {
  if (!telegramEnabled) {
    console.log(`[telegram mock] ${text}`);
    return { mocked: true };
  }
  const url = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
  const results = [];
  for (const chatId of telegramConfig.chatIds) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`telegram_send_failed:${response.status}:${body.slice(0, 160)}`);
    }
    results.push(await response.json());
  }
  return { mocked: false, results };
}

// ── HTML helpers ─────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Email shell — wrap content inside the standard card layout (table-based for Outlook compat)
 * @param {string} innerHtml  HTML ที่จะวางใน body card
 * @param {string} [title]    ถ้ามี — แสดงในแถบสีบน (header)
 */
function emailShell(innerHtml, title) {
  return `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Sarabun,Tahoma,sans-serif;background:#f4f6f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:10px;overflow:hidden;
                    box-shadow:0 2px 10px rgba(0,0,0,.08);max-width:640px;">
        ${title ? `
        <tr>
          <td style="background:linear-gradient(135deg,#1a73e8 0%,#1557b0 100%);padding:18px 36px;">
            <div style="color:#fff;font-size:13px;letter-spacing:1px;opacity:.85;">
              IT REQUEST SYSTEM · แผนกเทคโนโลยีสารสนเทศ
            </div>
            <div style="color:#fff;font-size:20px;font-weight:600;margin-top:4px;">
              ${escapeHtml(title)}
            </div>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:30px 36px;">
            ${innerHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fa;padding:14px 36px;border-top:1px solid #e9ecef;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              © ${new Date().getFullYear()} Phitsanulok Sugar Cane · ระบบขอใช้งาน IT
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(text, { bg = '#dbeafe', fg = '#1d4ed8' } = {}) {
  return `<span style="background:${bg};color:${fg};padding:2px 10px;border-radius:6px;font-weight:600;">${escapeHtml(text)}</span>`;
}

function infoRow(label, valueHtml) {
  return `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#6b7280;width:120px;background:#f9fafb;border-bottom:1px solid #f0f1f3;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 14px;font-size:14px;color:#1f2937;border-bottom:1px solid #f0f1f3;">
        ${valueHtml}
      </td>
    </tr>`;
}

function ctaButton(href, label, { color = '#1a73e8' } = {}) {
  if (!href) return '';
  return `
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${href}"
         style="display:inline-block;background:${color};color:#fff;text-decoration:none;
                padding:13px 40px;border-radius:7px;font-size:15px;font-weight:600;">
        ${escapeHtml(label)}
      </a>
    </div>`;
}

function noticeBox(text, { bg = '#fff8e1', border = '#f9a825', fg = '#7b6000' } = {}) {
  return `
    <p style="margin:18px 0 0;padding:14px 16px;background:${bg};
              border-left:4px solid ${border};border-radius:4px;
              font-size:12px;color:${fg};line-height:1.7;">
      ${text}
    </p>`;
}

// ── Email templates ──────────────────────────────────────────────────

/** ส่งอีเมลแจ้งผู้เซ็นช่องเดียว (ตามลำดับ workflow) */
export async function notifyApproverStep(request, step) {
  if (!step?.approver?.email) return null;
  const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const link = baseUrl ? `${baseUrl}${config.BASE_PATH}/#/approve/${request.id}` : '';

  const requester = request.requester || {};
  const inner = `
    <p style="margin:0 0 14px;font-size:15px;color:#111827;">
      เรียน ${badge('คุณ' + (step.approver.name || ''), { bg: '#fff3cd', fg: '#7b5200' })}
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.9;">
      &nbsp;&nbsp;&nbsp;&nbsp;มีคำขอใช้งาน IT รอท่านอนุมัติในขั้นที่
      ${badge(`#${step.step_no}`, { bg: '#dcfce7', fg: '#166534' })}
      &nbsp;${badge(step.slot_label || '-', { bg: '#dbeafe', fg: '#1d4ed8' })}
    </p>

    <table cellpadding="0" cellspacing="0" width="100%"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-top:18px;">
      ${infoRow('เลขที่', `<b>${escapeHtml(request.request_no)}</b>`)}
      ${infoRow('ประเภท', escapeHtml(request.request_type?.name || '-'))}
      ${infoRow('หัวข้อ', escapeHtml(request.title || '-'))}
      ${infoRow('ผู้ขอ', `
        ${escapeHtml(requester.name || '-')}
        <div style="color:#6b7280;font-size:12px;margin-top:2px;">
          ${escapeHtml(requester.position || '')}${requester.department ? ' · ' + escapeHtml(requester.department) : ''}
        </div>
      `)}
    </table>

    ${ctaButton(link, '✅ เปิดระบบเพื่อพิจารณาอนุมัติ')}

    ${noticeBox(`
      📌 อีเมลนี้ส่งโดยอัตโนมัติ — กรุณาอย่าตอบกลับ<br>
      📌 หลังจากท่านอนุมัติ ระบบจะส่งให้ผู้อนุมัติคนถัดไปอัตโนมัติ
    `)}
  `;

  return sendEmail({
    to: step.approver.email,
    subject: `[IT Request] โปรดอนุมัติคำขอ ${request.request_no} (ขั้นที่ ${step.step_no})`,
    html: emailShell(inner, 'รอท่านพิจารณาอนุมัติ'),
    text: `คำขอ ${request.request_no} (${request.title}) รอท่านอนุมัติ — ขั้นที่ ${step.step_no} · ${step.slot_label || ''}`,
  });
}

/** ส่งอีเมลแจ้งผู้ขอว่าคำขอถูกยกเลิก/เปลี่ยนสถานะ */
export async function notifyRequesterStatus(request, { subject, body }) {
  if (!request?.requester?.email) return null;
  const inner = `
    <p style="margin:0 0 14px;font-size:15px;color:#111827;">
      เรียน ${badge('คุณ' + (request.requester.name || ''), { bg: '#fff3cd', fg: '#7b5200' })}
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.9;">
      &nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(body)}
    </p>

    <table cellpadding="0" cellspacing="0" width="100%"
           style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-top:18px;">
      ${infoRow('เลขที่', `<b>${escapeHtml(request.request_no)}</b>`)}
      ${infoRow('หัวข้อ', escapeHtml(request.title || '-'))}
      ${infoRow('สถานะปัจจุบัน', badge(request.status || '-', { bg: '#fee2e2', fg: '#991b1b' }))}
    </table>

    ${noticeBox('📌 อีเมลนี้ส่งโดยอัตโนมัติ — กรุณาอย่าตอบกลับ')}
  `;
  return sendEmail({
    to: request.requester.email,
    subject,
    html: emailShell(inner, 'อัปเดตคำขอของท่าน'),
    text: `${body} (${request.request_no})`,
  });
}
