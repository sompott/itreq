import express from 'express';
import path from 'path';
import { config, getEmpPicture, getEmpSignature, ssoEnabled, authConfig } from './config.js';
import { pingAppDB, pingEmpDB, pingItServiceDB, pingItServiceEmpDB } from './db.js';
import { listActiveRequestTypes } from './repositories/requestTypes.js';
import { getActiveFormByType, getApprovalSlotsByType, getITSigningEmployees } from './repositories/forms.js';
import {
  createRequest,
  listRequests,
  getRequestById,
  approveStep,
  rejectStep,
  returnStepForRevision,
  updateRequestFormValues,
  resubmitReturnedRequest,
  updateRequestStatus,
  upsertRequestFieldValues,
  cancelRequest,
  deleteRequest,
  listPendingApprovals,
  listApprovalActivity,
  listITQueue,
  getRequestLogs,
  getNextPendingStep,
  markStepEmailed,
  getRequestNoConfig,
  saveRequestNoConfig,
  getRequestTypeRequestNoConfig,
  saveRequestTypeRequestNoConfig,
} from './repositories/requests.js';
import {
  listAllRequestTypes,
  createRequestType,
  updateRequestType,
  deleteRequestType,
  permanentlyDeleteRequestType,
  getFormDesign,
  saveFormDesign,
  listUserRoles,
  upsertUserRole,
  removeUserRole,
  reportSummary,
  listCompletedRequests,
} from './repositories/admin.js';
import {
  createNotification,
  listForRecipient,
  countUnread,
  markRead,
  markAllRead,
} from './repositories/notifications.js';
import {
  saveAttachment,
  listForRequest as listAttachmentsForRequest,
  getAttachmentFilePath,
  listImageFilesForRequest,
} from './repositories/attachments.js';
import { saveTemplate, getTemplatePath, removeTemplate } from './repositories/templates.js';
import { signatureFilePath } from './repositories/signatures.js';
import { signITRequest } from './repositories/itSignatures.js';
import { searchEmployees, getEmployeeById } from './repositories/employees.js';
import {
  acknowledgeServiceJob,
  closeServiceJob,
  createServiceJob,
  createServiceType,
  deleteServiceJob,
  deleteServiceType,
  getNextServiceJobId,
  getServiceJob,
  listServiceJobs,
  listServiceTypeRecords,
  listServiceTypes,
  reopenServiceJob,
  resetServiceJobAcknowledge,
  searchServiceEmployees,
  serviceJobReport,
  toggleServiceJobOverwork,
  updateServiceType,
} from './repositories/itServices.js';
import {
  createNotebookRequest,
  deleteNotebookRequest,
  getNotebookRequest,
  getNotebookUsage,
  listNotebookRequests,
  updateNotebookRequestStatus,
} from './repositories/notebookRequests.js';
import { attachUser, requireAuth, buildAuthUser, resolveEmpCodeFromCookie } from './auth.js';
import { notifyApproverStep, notifyRequesterStatus, sendTelegramMessage } from './mailer.js';
import { initStorage } from './storage.js';
import { renderDocx } from './docxRender.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

// CORS (allow cookie credentials)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(attachUser);

const api = express.Router();

// ── Health ───────────────────────────────────────────────────────────
api.get('/health', async (_req, res) => {
  const status = { ok: true, app: config.APP_NAME, sso: ssoEnabled };
  try { status.app_db = (await pingAppDB()) ? 'up' : 'down'; }
  catch (err) { status.app_db = 'down'; status.app_db_error = err.code || err.message; }
  try { status.emp_db = (await pingEmpDB()) ? 'up' : 'disabled'; }
  catch (err) { status.emp_db = 'down'; status.emp_db_error = err.code || err.message; }
  try { status.it_service_db = (await pingItServiceDB()) ? 'up' : 'disabled'; }
  catch (err) { status.it_service_db = 'down'; status.it_service_db_error = err.code || err.message; }
  try { status.it_service_emp_db = (await pingItServiceEmpDB()) ? 'up' : 'disabled'; }
  catch (err) { status.it_service_emp_db = 'down'; status.it_service_emp_db_error = err.code || err.message; }
  res.json(status);
});

// ── Auth ─────────────────────────────────────────────────────────────
api.get('/auth/me', async (req, res) => {
  try {
    const empCode = resolveEmpCodeFromCookie(req);
    if (!empCode) {
      return res.status(401).json({
        success: false,
        error: ssoEnabled ? 'no_session' : 'sso_not_configured',
        login_url: authConfig.iisLoginUrl,
      });
    }
    const user = await buildAuthUser(empCode);
    if (!user) return res.status(401).json({ success: false, error: 'employee_not_found', login_url: authConfig.iisLoginUrl });
    res.json({ success: true, user });
  } catch (err) {
    console.error('[/auth/me] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/auth/login', async (req, res) => {
  const empCode = req.body.emp_code || req.body.empCode;
  if (!empCode) return res.status(400).json({ error: 'emp_code_required' });
  try {
    const user = await buildAuthUser(empCode);
    if (!user) return res.status(404).json({ error: 'employee_not_found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.get('/auth/login', (_req, res) => res.redirect(302, authConfig.iisLoginUrl));

// Diagnostic — แสดง cookie ที่ server ได้รับ และผลถอด token
api.get('/auth/debug', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const origin = req.headers.origin || null;
  const host = req.headers.host || null;
  let token = null;
  try {
    const m = cookieHeader.match(/Token=([^;&\s]+)/);
    token = m ? m[1] : null;
  } catch {}
  let empCode = null;
  let decryptError = null;
  try {
    empCode = resolveEmpCodeFromCookie(req);
  } catch (err) { decryptError = err.message; }
  res.json({
    sso_enabled: ssoEnabled,
    has_decryption_key: Boolean(authConfig.decryptionKey),
    request_host: host,
    request_origin: origin,
    raw_cookie_header: cookieHeader,
    token_extracted: token ? `${token.slice(0, 12)}…(${token.length} chars)` : null,
    decrypted_emp_code: empCode,
    decrypt_error: decryptError,
    user_on_req: req.user ? { emp_id: req.user.emp_id, role: req.user.role, name: req.user.name } : null,
  });
});

// ── Employees (read-only) ────────────────────────────────────────────
api.get('/employees', async (req, res, next) => {
  try {
    const employees = await searchEmployees(req.query.q || '');
    res.json({ employees });
  } catch (err) { next(err); }
});

api.get('/employees/:empId', async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.params.empId);
    if (!employee) return res.status(404).json({ error: 'employee_not_found' });
    res.json({ employee });
  } catch (err) { next(err); }
});

// ── Request types / Forms (public for requester) ─────────────────────
api.get('/request-types', async (_req, res, next) => {
  try {
    res.json({ request_types: await listActiveRequestTypes() });
  } catch (err) { next(err); }
});

api.get('/request-types/:id/form', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const form = await getActiveFormByType(id);
    if (!form) return res.status(404).json({ error: 'form_not_found' });
    const approval_slots = await getApprovalSlotsByType(id);
    res.json({ form, approval_slots });
  } catch (err) { next(err); }
});

// ── Requests ─────────────────────────────────────────────────────────
api.post('/requests/draft', requireAuth, async (req, res, next) => {
  try {
    const request = await createRequest({ ...parseRequestBody(req), status: 'draft' });
    res.status(201).json({ request });
  } catch (err) { next(err); }
});

api.post('/requests', requireAuth, async (req, res, next) => {
  try {
    const request = await createRequest({ ...parseRequestBody(req), status: 'pending' });

    // ส่งให้ผู้อนุมัติคนแรก (step_no ต่ำสุดที่ pending) เท่านั้น
    await dispatchNextApprover(request);

    res.status(201).json({ request });
  } catch (err) { next(err); }
});

/**
 * แจ้งผู้อนุมัติของ step ถัดไป (ทั้ง in-app notification และอีเมล)
 * เรียกหลัง create และหลัง approve แต่ละครั้ง
 */
async function dispatchNextApprover(request) {
  const next = await getNextPendingStep(request.id);
  if (next?.signer_mode === 'it_staff' && !next.approver_emp_id) {
    if (next.email_sent_at) return;
    const recipients = await getITSigningEmployees();
    for (const employee of recipients) {
      await createNotification({ recipientEmpId: employee.emp_id, requestId: request.id,
        type: 'approval_required', title: `รอลงนาม: ${request.request_no} (${next.slot_label})`,
        message: next.slot_label, linkUrl: `${config.BASE_PATH}/#/approve/${request.id}`,
      }).catch((err) => console.warn('[notification] IT signing:', err.message));
      await notifyApproverStep(request, { ...next, approver: employee })
        .catch((err) => console.warn('[email] IT signing:', err.message));
    }
    if (recipients.length) await markStepEmailed(next.id);
    return;
  }
  if (!next?.approver_emp_id) return;

  await createNotification({
    recipientEmpId: next.approver_emp_id,
    requestId: request.id,
    type: 'approval_required',
    title: `รออนุมัติ: ${request.request_no} (ขั้นที่ ${next.step_no})`,
    message: `${request.requester?.name || ''} ส่งคำขอ "${request.title}" ให้ท่านอนุมัติ`,
    linkUrl: `${config.BASE_PATH}/#/approve/${request.id}`,
  }).catch((err) => console.warn('[notification] error:', err.message));

  const stepWithApprover = request.approval_steps?.find((s) => s.step_no === next.step_no) || next;
  notifyApproverStep(request, stepWithApprover)
    .then(() => markStepEmailed(next.id))
    .catch((err) => console.warn('[email] notify error:', err.message));
}

function notifyItServiceTelegram(action, job, actor = null) {
  const publicBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const link = publicBase ? `${publicBase}${config.BASE_PATH}/#/it-services` : `${config.BASE_PATH}/#/it-services`;
  const actorLine = actor?.emp_id ? `ผู้ทำรายการ: ${actor.name || actor.emp_id}` : '';
  const text = [
    'IT Service',
    `${action}: #${job?.id || '-'}`,
    job?.type ? `ประเภท: ${job.type}` : '',
    job?.details ? `รายละเอียด: ${truncateTelegramLine(job.details)}` : '',
    job?.applicant_name || job?.service_applicant
      ? `ผู้ขอ: ${job.applicant_name || job.service_applicant}`
      : '',
    job?.provider_name || job?.service_provider
      ? `ผู้รับงาน: ${job.provider_name || job.service_provider}`
      : '',
    actorLine,
    `เปิดดู: ${link}`,
  ].filter(Boolean).join('\n');

  sendTelegramMessage({ text })
    .catch((err) => console.warn('[telegram] it-service error:', err.message));
}

function truncateTelegramLine(value, max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

api.get('/requests', async (req, res, next) => {
  try {
    const requests = await listRequests({
      requesterEmpId: req.query.requester || (req.query.mine === '1' ? req.user?.emp_id : undefined),
      status: req.query.status || undefined,
      limit: req.query.limit || 100,
    });
    res.json({ requests });
  } catch (err) { next(err); }
});

api.get('/requests/pending-approvals', requireAuth, async (req, res, next) => {
  try {
    res.json({ items: await listPendingApprovals(req.user.emp_id, ['admin', 'it_staff'].includes(req.user.role)) });
  } catch (err) { next(err); }
});

api.get('/requests/approval-activity', requireAuth, async (req, res, next) => {
  try {
    const items = await listApprovalActivity({
      empCode: req.user.emp_id,
      isAdmin: req.user.role === 'admin',
      isITStaff: ['admin', 'it_staff'].includes(req.user.role),
    });
    res.json({ items, scope: req.user.role === 'admin' ? 'all' : 'mine' });
  } catch (err) { next(err); }
});

api.get('/requests/it-queue', requireAuth, async (_req, res, next) => {
  try {
    res.json({ items: await listITQueue() });
  } catch (err) { next(err); }
});

api.get('/requests/:id', async (req, res, next) => {
  try {
    const request = await getRequestById(Number(req.params.id));
    if (!request) return res.status(404).json({ error: 'request_not_found' });
    const attachments = await listAttachmentsForRequest(request.id);
    const logs = await getRequestLogs(request.id);
    res.json({ request, attachments, logs });
  } catch (err) { next(err); }
});

api.post('/requests/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const request = await approveStep({
      requestId: Number(req.params.id),
      stepNo: Number(req.body.step_no),
      approverEmpId: req.user.emp_id,
      signatureType: req.body.signature_type || 'draw',
      signatureData: req.body.signature_data || null,
      comment: req.body.comment || null,
      isITStaff: ['admin', 'it_staff'].includes(req.user.role),
    });

    const signedStep = request.approval_steps.find((step) => step.step_no === Number(req.body.step_no));
    if (request.status === 'approved' && signedStep?.sign_stage === 'approval') {
      // อนุมัติครบทุกขั้นแล้ว — แจ้ง requester
      await createNotification({
        recipientEmpId: request.requester_emp_id,
        requestId: request.id,
        type: 'approved',
        title: `คำขอ ${request.request_no} ได้รับอนุมัติแล้ว`,
        message: `อนุมัติครบทุกขั้น พร้อมส่งเข้าแผนก IT`,
        linkUrl: `${config.BASE_PATH}/#/my/${request.id}`,
      });
    }
    await dispatchNextApprover(request);
    res.json({ request });
  } catch (err) { next(err); }
});

api.post('/requests/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const request = await cancelRequest({
      requestId: Number(req.params.id),
      actorEmpId: req.user.emp_id,
      isAdmin: req.user.role === 'admin',
      note: req.body?.note || null,
    });

    // แจ้งผู้อนุมัติทุกคนที่กำลังรอ (ถ้าคนหนึ่งเปิดอยู่จะได้ทราบว่าถูกยกเลิก)
    const targets = (request.approval_steps || [])
      .filter((s) => s.approver_emp_id && s.approver_emp_id !== req.user.emp_id);
    for (const step of targets) {
      await createNotification({
        recipientEmpId: step.approver_emp_id,
        requestId: request.id,
        type: 'status_change',
        title: `คำขอ ${request.request_no} ถูกยกเลิก`,
        message: req.body?.note || 'ผู้ขอยกเลิกคำขอนี้แล้ว',
        linkUrl: `${config.BASE_PATH}/#/approve/${request.id}`,
      }).catch((err) => console.warn('[notification] cancel:', err.message));
    }

    // แจ้ง requester ทางอีเมล (กรณีคนยกเลิกคือ admin)
    if (req.user.emp_id !== request.requester_emp_id) {
      notifyRequesterStatus(request, {
        subject: `[IT Request] คำขอ ${request.request_no} ถูกยกเลิกโดยผู้ดูแลระบบ`,
        body: `คำขอของท่านถูกยกเลิก${req.body?.note ? ` — เหตุผล: ${req.body.note}` : ''}`,
      }).catch((err) => console.warn('[email] cancel:', err.message));
    }

    res.json({ request });
  } catch (err) { next(err); }
});

api.delete('/requests/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await deleteRequest({
      requestId: Number(req.params.id),
      actorEmpId: req.user.emp_id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

api.post('/requests/:id/reject', requireAuth, async (req, res, next) => {
  try {
    const request = await rejectStep({
      requestId: Number(req.params.id),
      stepNo: Number(req.body.step_no),
      approverEmpId: req.user.emp_id,
      comment: req.body.comment || null,
    });
    await createNotification({
      recipientEmpId: request.requester_emp_id,
      requestId: request.id,
      type: 'rejected',
      title: `คำขอ ${request.request_no} ถูกปฏิเสธ`,
      message: req.body.comment || 'ถูกปฏิเสธโดยไม่มีเหตุผลเพิ่ม',
      linkUrl: `${config.BASE_PATH}/#/my/${request.id}`,
    });
    res.json({ request });
  } catch (err) { next(err); }
});

api.post('/requests/:id/return-for-revision', requireAuth, requireITStaff, async (req, res, next) => {
  try {
    const request = await returnStepForRevision({
      requestId: Number(req.params.id),
      approverEmpId: req.user.emp_id,
      comment: req.body.comment,
    });
    await createNotification({
      recipientEmpId: request.requester_emp_id,
      requestId: request.id,
      type: 'status_change',
      title: `คำขอ ${request.request_no} ถูกตีกลับให้แก้ไข`,
      message: req.body.comment,
      linkUrl: `${config.BASE_PATH}/#/my/${request.id}`,
    });
    res.json({ request });
  } catch (err) { next(err); }
});

api.put('/requests/:id/form-values', requireAuth, async (req, res, next) => {
  try {
    const request = await updateRequestFormValues({
      requestId: Number(req.params.id),
      values: req.body?.values || {},
      actorEmpId: req.user.emp_id,
      isAdmin: req.user.role === 'admin',
    });
    res.json({ request });
  } catch (err) { next(err); }
});

api.post('/requests/:id/resubmit', requireAuth, async (req, res, next) => {
  try {
    const request = await resubmitReturnedRequest({
      requestId: Number(req.params.id),
      actorEmpId: req.user.emp_id,
      isAdmin: req.user.role === 'admin',
    });
    await dispatchNextApprover(request);
    res.json({ request });
  } catch (err) { next(err); }
});

api.patch('/requests/:id/status', requireAuth, requireITStaff, async (req, res, next) => {
  try {
    const request = await updateRequestStatus({
      requestId: Number(req.params.id),
      status: req.body.status,
      actorEmpId: req.user.emp_id,
      note: req.body.note,
    });
    await dispatchNextApprover(request);
    await createNotification({
      recipientEmpId: request.requester_emp_id,
      requestId: request.id,
      type: 'status_change',
      title: `คำขอ ${request.request_no} → ${request.status}`,
      message: req.body.note || '',
      linkUrl: `${config.BASE_PATH}/#/my/${request.id}`,
    });
    res.json({ request });
  } catch (err) { next(err); }
});

api.patch('/requests/:id/field-values', requireAuth, requireITStaff, async (req, res, next) => {
  try {
    const request = await upsertRequestFieldValues({
      requestId: Number(req.params.id),
      values: req.body?.values || {},
      actorEmpId: req.user.emp_id,
    });
    res.json({ request });
  } catch (err) { next(err); }
});

api.post('/requests/:id/it-sign', requireAuth, requireITStaff, async (req, res, next) => {
  try {
    await signITRequest({
      requestId: Number(req.params.id),
      phase: req.body.phase,
      signerEmpId: req.user.emp_id,
      signatureType: req.body.signature_type,
      signatureData: req.body.signature_data,
      comment: req.body.comment,
    });
    res.json({ request: await getRequestById(Number(req.params.id)) });
  } catch (err) { next(err); }
});

async function buildTemplateVariables(request, req) {
  const r = request.requester || {};
  const variables = {
    request_no: request.request_no,
    request_type: request.request_type?.name || '',
    urgency: request.urgency || '',
    status: request.status || '',
    created_date: formatThaiDate(request.created_at),
    submitted_date: formatThaiDate(request.submitted_at),
    title: request.title,
    detail: request.detail || '',
    requester_emp_id: r.emp_id || '',
    requester_name: r.name || '',
    requester_first_name: r.first_name || '',
    requester_last_name: r.last_name || '',
    requester_nickname: r.nickname || '',
    requester_position: r.position || '',
    requester_department: r.department || '',
    requester_section: r.section || '',
    requester_email: r.email || '',
    requester_phone: r.phone || '',
    requester_picture: r.picture_url || (r.emp_id ? getEmpPicture(r.emp_id) : ''),
    requester_signature: r.signature_url || (r.emp_id ? getEmpSignature(r.emp_id) : ''),
    ...request.values,
  };

  // Compatibility aliases used by FM-IT-02 / FM-IT-07 Word templates.
  variables.ad = request.values.user || request.values.ad || '';
  variables.itname = request.values.comname || request.values.itname || '';

  // per-option vars (checkbox / radio / dropdown)
  try {
    const form = await getActiveFormByType(request.request_type_id);
    const formFields = form?.fields || [];
    for (const f of formFields) {
      if (!['checkbox', 'radio', 'dropdown'].includes(f.field_type)) continue;
      const options = Array.isArray(f.options) ? f.options : [];
      const selected = parseSelectedOptions(request.values[f.field_name]);
      if (f.field_type === 'checkbox') {
        variables[f.field_name] = selected.join(', ');
      }
      for (const opt of options) {
        const key = `check_${f.field_name}_${slugifyOption(opt)}`;
        variables[key] = selected.includes(opt) ? '✓' : '';
      }
      if (f.validation?.allow_other) {
        const other = selected.find((value) => /^อื่น\s*ๆ\s*:/i.test(value));
        const otherText = other
          ? other.replace(/^อื่น\s*ๆ\s*:\s*/i, '')
          : (request.values.other || '');
        const otherCheckKey = `check_${f.field_name}_other`;
        // Some forms contain a literal English "Other" option in addition
        // to allow_other. Do not overwrite the check produced for that option.
        variables[otherCheckKey] = other ? '✓' : (variables[otherCheckKey] || '');
        variables[`${f.field_name}_other_text`] = otherText;
        // Compatibility with early templates that used {{hardware_other}}
        // instead of the documented {{hardware_other_text}} form.
        variables[`${f.field_name}_other`] = otherText;
      }

      // FM-IT-06 Rev.00 originally used "network1" in its Word tags while
      // the form field is named "network". Keep both names working.
      if (f.field_name === 'network') {
        const isSelected = (...patterns) => selected.some((value) =>
          patterns.some((pattern) => pattern.test(value)));
        variables.check_network1_wifi_internet_email = isSelected(/wifi/i, /internet/i, /email/i) ? '✓' : '';
        variables.check_network1_useraccount = isSelected(/user\s*account/i, /useraccount/i) ? '✓' : '';
        variables.check_network1_other = variables.check_network_other || '';
        variables.network1_other = variables.network_other_text || '';
      }
    }

    // Legacy names embedded in FM-IT-06 Rev.00.
    variables.otherhw = variables.software_other_text || '';
    variables.othernw = variables.network_other_text || '';
  } catch (err) {
    console.warn('[template-data] per-option vars failed:', err.message);
  }

  // ผู้อนุมัติแต่ละขั้น
  const baseUrl = req
    ? `${req.protocol}://${req.get('host')}${config.API_PREFIX}`
    : '';
  for (const step of request.approval_steps) {
    const a = step.approver || {};
    const prefix = `approver_${step.step_no}`;
    variables[`${prefix}_slot_label`] = step.slot_label || '';
    variables[`${prefix}_status`] = step.status || '';
    variables[`${prefix}_comment`] = step.comment || '';
    variables[`${prefix}_signed_at`] = step.signed_at ? formatThaiDate(step.signed_at) : '';
    variables[`${prefix}_emp_id`] = a.emp_id || '';
    variables[`${prefix}_name`] = a.name || '';
    variables[`${prefix}_first_name`] = a.first_name || '';
    variables[`${prefix}_last_name`] = a.last_name || '';
    variables[`${prefix}_nickname`] = a.nickname || '';
    variables[`${prefix}_position`] = a.position || '';
    variables[`${prefix}_department`] = a.department || '';
    variables[`${prefix}_section`] = a.section || '';
    variables[`${prefix}_email`] = a.email || '';
    variables[`${prefix}_phone`] = a.phone || '';
    // ลายเซ็นจะแสดงเฉพาะ step ที่ approve แล้วเท่านั้น — ไม่ใช้รูปโปรไฟล์เป็น fallback
    if (step.status === 'approved') {
      variables[`${prefix}_signature`] = step.signature_file
        ? `${baseUrl}/signatures/${encodeURIComponent(step.signature_file)}`
        : (step.signature_data || '');
    } else {
      variables[`${prefix}_signature`] = '';
    }
  }
  for (const phase of ['acceptance', 'completion']) {
    const signature = request.approval_steps.find((step) => step.sign_stage === phase && step.status === 'approved')
      || (request.it_signatures || []).find((item) => item.phase === phase);
    const prefix = `it_${phase}`;
    variables[`${prefix}_name`] = signature?.approver?.name || signature?.signer_emp_id || '';
    variables[`${prefix}_emp_id`] = signature?.signer_emp_id || signature?.approver_emp_id || '';
    variables[`${prefix}_signed_at`] = signature?.signed_at ? formatThaiDate(signature.signed_at) : '';
    variables[`${prefix}_comment`] = signature?.comment || '';
    variables[`${prefix}_signature`] = signature?.signature_file
      ? `${baseUrl}/signatures/${encodeURIComponent(signature.signature_file)}`
      : (signature?.signature_data || '');
  }
  return variables;
}

api.get('/requests/:id/template-data', async (req, res, next) => {
  try {
    const request = await getRequestById(Number(req.params.id));
    if (!request) return res.status(404).json({ error: 'request_not_found' });
    const variables = await buildTemplateVariables(request, req);
    res.json({
      variables,
      available_placeholders: Object.keys(variables).map((k) =>
        /signature|picture/.test(k) ? `{{%${k}}}` : `{{${k}}}`,
      ),
    });
  } catch (err) { next(err); }
});

api.get('/requests/:id/word', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const request = await getRequestById(id);
    if (!request) return res.status(404).json({ error: 'request_not_found' });

    const templatePath = await getTemplatePath(request.request_type_id);
    if (!templatePath) return res.status(404).json({ error: 'template_not_found' });

    const variables = await buildTemplateVariables(request, req);
    const appendImages = await listImageFilesForRequest(request.id);
    const buf = await renderDocx(templatePath, variables, { appendImages });

    // The same request URL can produce different content after approvals or
    // IT-filled fields are updated. Never let the browser reuse an older file.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${request.request_no}.docx"`,
    );
    res.send(buf);
  } catch (err) {
    if (err?.properties?.errors) {
      console.error('[word render] template errors:');
      err.properties.errors.forEach((e, i) =>
        console.error(`  [${i}]`, e.message, e.properties),
      );
      return res.status(400).json({
        error: 'template_render_failed',
        details: err.properties.errors.map((e) => ({
          tag: e.properties?.xtag || e.properties?.id || '?',
          message: e.properties?.explanation || e.message,
        })),
      });
    }
    next(err);
  }
});

// ── Attachments ──────────────────────────────────────────────────────
api.post('/requests/:id/attachments', requireAuth, async (req, res, next) => {
  try {
    const att = await saveAttachment({
      requestId: Number(req.params.id),
      fieldId: req.body.field_id || null,
      kind: req.body.kind || 'request',
      fileName: req.body.file_name,
      mimeType: req.body.mime_type,
      dataBase64: req.body.data_base64,
      uploadedBy: req.user.emp_id,
    });
    res.status(201).json({ attachment: att });
  } catch (err) { next(err); }
});

api.get('/signatures/:filename', (req, res, next) => {
  try {
    const filename = String(req.params.filename || '');
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'invalid_filename' });
    }
    const full = signatureFilePath(filename);
    if (!full) return res.status(404).json({ error: 'signature_not_found' });
    res.type(filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
    res.sendFile(full, (err) => {
      if (err) {
        if (!res.headersSent) res.status(404).json({ error: 'signature_not_found' });
      }
    });
  } catch (err) { next(err); }
});

api.get('/attachments/:id', async (req, res, next) => {
  try {
    const info = await getAttachmentFilePath(Number(req.params.id));
    if (!info) return res.status(404).json({ error: 'attachment_not_found' });
    if (info.mime_type) res.type(info.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(info.file_name)}"`);
    res.sendFile(info.full_path);
  } catch (err) { next(err); }
});

// ── Notifications ────────────────────────────────────────────────────
api.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === '1';
    const items = await listForRecipient(req.user.emp_id, { unreadOnly, limit: req.query.limit || 30 });
    const unread = await countUnread(req.user.emp_id);
    res.json({ items, unread });
  } catch (err) { next(err); }
});

api.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    await markRead(Number(req.params.id), req.user.emp_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

api.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await markAllRead(req.user.emp_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Admin (require role=admin) ───────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'admin_required' });
}

function requireITStaff(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'it_staff') return next();
  res.status(403).json({ error: 'it_staff_required' });
}

api.get('/admin/request-types', requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json({ request_types: await listAllRequestTypes() }); }
  catch (err) { next(err); }
});

api.post('/admin/request-types', requireAuth, requireAdmin, async (req, res, next) => {
  try { res.status(201).json({ request_type: await createRequestType(req.body) }); }
  catch (err) { next(err); }
});

api.put('/admin/request-types/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try { res.json({ request_type: await updateRequestType(Number(req.params.id), req.body) }); }
  catch (err) { next(err); }
});

api.delete('/admin/request-types/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await deleteRequestType(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

api.delete('/admin/request-types/:id/permanent', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const deleted = await permanentlyDeleteRequestType(Number(req.params.id));
    res.json({ ok: true, deleted });
  } catch (err) { next(err); }
});

api.get('/admin/request-types/:id/design', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const design = await getFormDesign(Number(req.params.id));
    if (!design) return res.status(404).json({ error: 'request_type_not_found' });
    res.json(design);
  } catch (err) { next(err); }
});

api.put('/admin/request-types/:id/design', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const design = await saveFormDesign(Number(req.params.id), req.body);
    res.json(design);
  } catch (err) { next(err); }
});

api.get('/admin/request-types/:id/request-no-config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.json({ config: await getRequestTypeRequestNoConfig(Number(req.params.id)) });
  } catch (err) { next(err); }
});

api.put('/admin/request-types/:id/request-no-config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.json({
      config: await saveRequestTypeRequestNoConfig(Number(req.params.id), req.body || {}),
    });
  } catch (err) { next(err); }
});

// Template (Word .docx) — upload/serve/remove
api.post('/admin/request-types/:id/template', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const info = await saveTemplate({
      requestTypeId: Number(req.params.id),
      originalName: req.body.file_name,
      dataBase64: req.body.data_base64,
    });
    res.status(201).json(info);
  } catch (err) { next(err); }
});

api.delete('/admin/request-types/:id/template', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await removeTemplate(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Serve template (used by browser to fill + download)
api.get('/request-types/:id/template', async (req, res, next) => {
  try {
    const full = await getTemplatePath(Number(req.params.id));
    if (!full) return res.status(404).json({ error: 'template_not_found' });
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.sendFile(full);
  } catch (err) { next(err); }
});

api.get('/admin/reports/summary', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const summary = await reportSummary({ from: req.query.from, to: req.query.to });
    res.json(summary);
  } catch (err) { next(err); }
});

api.get('/admin/reports/completed', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const items = await listCompletedRequests({
      from: req.query.from,
      to: req.query.to,
      requestTypeId: req.query.request_type_id,
      requesterEmpId: req.query.requester_emp_id,
      urgency: req.query.urgency,
      status: req.query.status,
      q: req.query.q,
      limit: req.query.limit,
    });
    res.json({ items });
  } catch (err) { next(err); }
});

api.get('/admin/request-no-config', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json({ config: await getRequestNoConfig() });
  } catch (err) { next(err); }
});

api.put('/admin/request-no-config', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.json({ config: await saveRequestNoConfig(req.body || {}) });
  } catch (err) { next(err); }
});

api.get('/admin/user-roles', requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json({ roles: await listUserRoles() }); }
  catch (err) { next(err); }
});

api.post('/admin/user-roles', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await upsertUserRole(req.body.emp_id, req.body.role);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

api.delete('/admin/user-roles', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await removeUserRole(req.body.emp_id, req.body.role);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Legacy IT Services integration
api.get('/it-services/types', requireAuth, async (_req, res, next) => {
  try {
    res.json({ types: await listServiceTypes() });
  } catch (err) { next(err); }
});

api.get('/it-services/type-records', requireAuth, async (_req, res, next) => {
  try {
    res.json({ types: await listServiceTypeRecords() });
  } catch (err) { next(err); }
});

api.post('/it-services/types', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json({ type: await createServiceType(req.body?.name) });
  } catch (err) { next(err); }
});

api.patch('/it-services/types/:id', requireAuth, async (req, res, next) => {
  try {
    res.json({ type: await updateServiceType(Number(req.params.id), req.body?.name) });
  } catch (err) { next(err); }
});

api.delete('/it-services/types/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteServiceType(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

api.get('/it-services/employees', requireAuth, async (req, res, next) => {
  try {
    const employees = await searchServiceEmployees({
      q: req.query.q || '',
      itOnly: req.query.scope === 'it',
    });
    res.json({ employees });
  } catch (err) { next(err); }
});

api.get('/it-services/jobs/next-id', requireAuth, async (_req, res, next) => {
  try {
    res.json({ next_id: await getNextServiceJobId() });
  } catch (err) { next(err); }
});

api.get('/it-services/jobs', requireAuth, async (req, res, next) => {
  try {
    const jobs = await listServiceJobs({
      status: req.query.status || 'open',
      limit: req.query.limit || 200,
    });
    res.json({ jobs });
  } catch (err) { next(err); }
});

api.get('/it-services/report', requireAuth, async (req, res, next) => {
  try {
    const items = await serviceJobReport({
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      startTime: req.query.start_time,
      endTime: req.query.end_time,
      type: req.query.type,
      provider: req.query.provider,
      limit: req.query.limit || 500,
    });
    res.json({ items });
  } catch (err) { next(err); }
});

api.get('/it-services/jobs/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await getServiceJob(Number(req.params.id));
    if (!job) return res.status(404).json({ error: 'job_not_found' });
    res.json({ job });
  } catch (err) { next(err); }
});

api.post('/it-services/jobs', requireAuth, async (req, res, next) => {
  try {
    const { type, details, applicant, provider } = req.body || {};
    if (!type || !details || !applicant || !provider) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }
    const job = await createServiceJob({ type, details, applicant, provider });
    notifyItServiceTelegram('สร้างงานใหม่', job, req.user);
    res.status(201).json({ job });
  } catch (err) { next(err); }
});

api.patch('/it-services/jobs/:id/acknowledge', requireAuth, async (req, res, next) => {
  try {
    const job = await acknowledgeServiceJob(Number(req.params.id), {
      dataAck: req.body?.data_ack || '',
      coadjutor1: req.body?.coadjutor1 || '',
      coadjutor2: req.body?.coadjutor2 || '',
    });
    notifyItServiceTelegram('รับทราบงาน', job, req.user);
    res.json({ job });
  } catch (err) { next(err); }
});

api.patch('/it-services/jobs/:id/acknowledge/reset', requireAuth, async (req, res, next) => {
  try {
    res.json({ job: await resetServiceJobAcknowledge(Number(req.params.id)) });
  } catch (err) { next(err); }
});

api.patch('/it-services/jobs/:id/overwork', requireAuth, async (req, res, next) => {
  try {
    const job = await toggleServiceJobOverwork(Number(req.params.id), {
      overworkDetails: req.body?.overwork_details || '',
    });
    res.json({ job });
  } catch (err) { next(err); }
});

api.patch('/it-services/jobs/:id/close', requireAuth, async (req, res, next) => {
  try {
    const { cause_job: causeJob, details_job: detailsJob } = req.body || {};
    if (!causeJob || !detailsJob) return res.status(400).json({ error: 'missing_required_fields' });
    const job = await closeServiceJob(Number(req.params.id), { causeJob, detailsJob });
    notifyItServiceTelegram('ปิดงาน', job, req.user);
    res.json({ job });
  } catch (err) { next(err); }
});

api.patch('/it-services/jobs/:id/reopen', requireAuth, async (req, res, next) => {
  try {
    const job = await reopenServiceJob(Number(req.params.id));
    notifyItServiceTelegram('เปิดงานกลับ', job, req.user);
    res.json({ job });
  } catch (err) { next(err); }
});

api.delete('/it-services/jobs/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteServiceJob(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

api.get('/it-services/notebook-requests', requireAuth, async (req, res, next) => {
  try {
    const requests = await listNotebookRequests({
      status: req.query.status || 'active',
      from: req.query.from,
      to: req.query.to,
      requesterEmpId: req.query.requester_emp_id,
      cookie: req.headers.cookie || '',
      limit: req.query.limit || 200,
    });
    res.json({ requests });
  } catch (err) { next(err); }
});

api.get('/it-services/notebook-requests/usage', requireAuth, async (req, res, next) => {
  try {
    res.json(await getNotebookUsage({
      from: req.query.from,
      to: req.query.to,
      cookie: req.headers.cookie || '',
      excludeId: req.query.exclude_id ? Number(req.query.exclude_id) : null,
    }));
  } catch (err) { next(err); }
});

api.get('/it-services/notebook-requests/:id', requireAuth, async (req, res, next) => {
  try {
    const request = await getNotebookRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ error: 'notebook_request_not_found' });
    res.json({ request });
  } catch (err) { next(err); }
});

api.post('/it-services/notebook-requests', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const request = await createNotebookRequest({
      ...body,
      requester_emp_id: body.requester_emp_id || req.user?.emp_id,
      requester_name: body.requester_name || req.user?.name,
      department: body.department || req.user?.department,
    });
    res.status(201).json({ request });
  } catch (err) { next(err); }
});

api.patch('/it-services/notebook-requests/:id/status', requireAuth, async (req, res, next) => {
  try {
    const request = await updateNotebookRequestStatus(Number(req.params.id), {
      status: req.body?.status,
      approvedBy: req.user?.emp_id,
    });
    if (!request) return res.status(404).json({ error: 'notebook_request_not_found' });
    res.json({ request });
  } catch (err) { next(err); }
});

api.delete('/it-services/notebook-requests/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteNotebookRequest(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.use(config.API_PREFIX, api);
app.use('/api', api);

// ── Serve frontend (Vite build) — เข้าผ่าน http://host:5101/itrequest/ ──
import { fileURLToPath } from 'url';
const __dirname_str = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname_str, '..', '..', 'frontend', 'dist');
import fs from 'fs';
const distExists = fs.existsSync(path.join(DIST_DIR, 'index.html'));
if (distExists) {
  // static files (assets/css/js)
  app.use(config.BASE_PATH, express.static(DIST_DIR));
  // SPA fallback — ทุก path ใต้ BASE_PATH ที่ไม่ใช่ API → ส่ง index.html
  app.get(new RegExp(`^${config.BASE_PATH}(/.*)?$`), (req, res, next) => {
    if (req.path.startsWith(config.API_PREFIX)) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  // เปิดที่ root → redirect ไป BASE_PATH
  app.get('/', (_req, res) => res.redirect(config.BASE_PATH + '/'));
  console.log(`  serving frontend from ${DIST_DIR} at ${config.BASE_PATH}/`);
} else {
  console.log(`  frontend not built — run "npm run build" then access via Vite (5173)`);
}

// ── error handler (ต้องอยู่หลัง mount routes ไม่งั้น Express ไม่จับ) ──
app.use((err, _req, res, _next) => {
  console.error('[API error]', err);
  const status = err.httpStatus || 500;
  res.status(status).json({ error: err.message || 'internal_error' });
});

app.listen(config.PORT, async () => {
  console.log(`IT request API listening on http://127.0.0.1:${config.PORT}${config.API_PREFIX}`);
  console.log(`  SSO via psweb2 cookie: ${ssoEnabled ? 'ENABLED' : 'disabled'}`);
  try { await pingAppDB(); console.log(`  ✓ app DB connected (${process.env.APP_DB_NAME || 'dbps_itreq'})`); }
  catch (err) { console.warn(`  ✗ app DB connection failed: ${err.code || err.message}`); }
  try {
    const ok = await pingEmpDB();
    console.log(ok ? `  ✓ employee DB connected (${process.env.EMP_DB_NAME})` : '  · employee DB disabled');
  } catch (err) { console.warn(`  ✗ employee DB connection failed: ${err.code || err.message}`); }
  await initStorage();
});

function parseRequestBody(req) {
  const body = req.body || {};
  return {
    // ผู้ขอคือคนที่ล็อกอินเสมอ — ไม่รับ requester_emp_id จาก body (กันสร้าง/เซ็นในนามคนอื่น)
    requesterEmpId: req.user?.emp_id,
    requestTypeId: Number(body.request_type_id),
    values: body.values || {},
    urgency: body.urgency || 'normal',
    selectedApprovers: body.selected_approvers || {},
    requesterSignature: body.requester_signature || null,
  };
}

function formatThaiDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}

/** แปลง option label → key ที่ใช้ใน Word placeholder (ตัดอักขระพิเศษ) */
function slugifyOption(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\w฀-๿]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** แปลงค่าใน DB → array ของ option ที่ผู้ขอเลือก */
function parseSelectedOptions(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((x) => String(x));
  const s = String(value);
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [String(parsed)];
  } catch {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
}
