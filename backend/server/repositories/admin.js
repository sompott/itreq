import { appDB } from '../db.js';
import { getRequestTypeRequestNoConfig } from './requests.js';
import fs from 'fs/promises';
import path from 'path';
import { templatesDir } from '../storage.js';

// ── Request Types ────────────────────────────────────────────────────
export async function listAllRequestTypes() {
  const [rows] = await appDB.query(
    `SELECT id, name, description, template_file, is_active, sort_order, created_at, updated_at
       FROM itreq_request_types
      ORDER BY sort_order, id`,
  );
  return rows;
}

export async function setRequestTypeTemplate(id, fileName) {
  await appDB.query(`UPDATE itreq_request_types SET template_file = ? WHERE id = ?`, [fileName, id]);
}

export async function createRequestType({ name, description, sort_order = 0, is_active = 1 }) {
  const [result] = await appDB.query(
    `INSERT INTO itreq_request_types (name, description, sort_order, is_active, it_acceptance_required, it_completion_required)
     VALUES (?, ?, ?, ?, 0, 0)`,
    [name, description || null, sort_order, is_active],
  );
  return await getRequestType(result.insertId);
}

export async function getRequestType(id) {
  const [rows] = await appDB.query(
    `SELECT id, name, description, template_file, is_active, sort_order
       FROM itreq_request_types WHERE id = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function updateRequestType(id, { name, description, sort_order, is_active }) {
  await appDB.query(
    `UPDATE itreq_request_types
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            sort_order = COALESCE(?, sort_order),
            is_active = COALESCE(?, is_active)
      WHERE id = ?`,
    [name ?? null, description ?? null, sort_order ?? null, is_active ?? null, id],
  );
  return await getRequestType(id);
}

export async function deleteRequestType(id) {
  // soft delete = is_active = 0 (เพื่อกัน FK กับ requests เดิม)
  await appDB.query(`UPDATE itreq_request_types SET is_active = 0 WHERE id = ?`, [id]);
}

/** ลบประเภทคำขอและแบบฟอร์มถาวร — อนุญาตเฉพาะกรณีที่ยังไม่มีคำขออ้างอิง */
export async function permanentlyDeleteRequestType(id) {
  const conn = await appDB.getConnection();
  let deletedType = null;
  try {
    await conn.beginTransaction();
    const [[type]] = await conn.query(
      `SELECT id, name, template_file FROM itreq_request_types WHERE id = ? FOR UPDATE`,
      [id],
    );
    if (!type) throw httpError('request_type_not_found', 404);

    const [[usage]] = await conn.query(
      `SELECT COUNT(*) AS total FROM itreq_requests WHERE request_type_id = ?`,
      [id],
    );
    const requestCount = Number(usage?.total || 0);
    if (requestCount > 0) {
      throw httpError(`request_type_in_use:${requestCount}`, 409);
    }

    await conn.query(`DELETE FROM itreq_request_types WHERE id = ?`, [id]);
    await conn.commit();
    deletedType = type;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  if (deletedType?.template_file && path.basename(deletedType.template_file) === deletedType.template_file) {
    try { await fs.unlink(path.join(templatesDir, deletedType.template_file)); } catch {}
  }
  return deletedType;
}

// ── Form definition (1 ประเภท = 1 form active) ───────────────────────
export async function getFormDesign(requestTypeId) {
  const [[type]] = await appDB.query(
    `SELECT id, name, description, is_active, template_file, it_acceptance_required, it_completion_required
       FROM itreq_request_types WHERE id = ?`,
    [requestTypeId],
  );
  if (!type) return null;

  // ผนวกข้อมูลไฟล์ template จาก filesystem (size + mtime)
  if (type.template_file) {
    try {
      const { stat } = await import('fs/promises');
      const { templatesDir } = await import('../storage.js');
      const path = await import('path');
      const filepath = path.join(templatesDir, type.template_file);
      const s = await stat(filepath);
      type.template_size = s.size;
      type.template_uploaded_at = s.mtime.toISOString();
    } catch {
      type.template_size = null;
      type.template_uploaded_at = null;
    }
  }

  const [forms] = await appDB.query(
    `SELECT id, name, version, is_active
       FROM itreq_form_definitions
      WHERE request_type_id = ? AND is_active = 1
      ORDER BY version DESC LIMIT 1`,
    [requestTypeId],
  );
  const form = forms[0] || null;

  let fields = [];
  if (form) {
    const [rows] = await appDB.query(
      `SELECT id, field_label, field_name, field_type, options, placeholder,
              default_value, is_required, sort_order, validation
         FROM itreq_form_fields
        WHERE form_id = ?
        ORDER BY sort_order, id`,
      [form.id],
    );
    fields = rows.map((r) => ({
      ...r,
      options: safeJson(r.options),
      validation: safeJson(r.validation),
      is_required: !!r.is_required,
    }));
  }

  const [slots] = await appDB.query(
    `SELECT id, step_no, slot_label, mode, fixed_emp_id, is_required, allow_skip, sign_stage
       FROM itreq_approval_slot_templates
      WHERE request_type_id = ?
      ORDER BY step_no`,
    [requestTypeId],
  );

  return {
    request_type: type,
    form,
    fields,
    slots: slots.map((s) => ({
      ...s,
      is_required: !!s.is_required,
      allow_skip: !!s.allow_skip,
    })),
    request_no_config: await getRequestTypeRequestNoConfig(requestTypeId),
  };
}

/**
 * บันทึก form ครบ 1 ชุด (form_definition + fields + slots) แบบ replace ทั้งหมด
 * ใช้ transaction เพื่อความครบถ้วน
 */
export async function saveFormDesign(requestTypeId, { name, fields = [], slots = [] }) {
  const normalizedFields = normalizeAndValidateFields(fields);
  const normalizedSlots = normalizeAndValidateSlots(slots);
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();

    const [[type]] = await conn.query(
      `SELECT id FROM itreq_request_types WHERE id = ?`,
      [requestTypeId],
    );
    if (!type) throw httpError('request_type_not_found', 404);

    await conn.query(`UPDATE itreq_request_types SET it_acceptance_required = ?, it_completion_required = ? WHERE id = ?`,
      ['acceptance', 'completion'].map((stage) => normalizedSlots.some((slot) => slot.sign_stage === stage && slot.is_required) ? 1 : 0).concat(requestTypeId));

    let [forms] = await conn.query(
      `SELECT id FROM itreq_form_definitions
        WHERE request_type_id = ? AND is_active = 1
        ORDER BY version DESC LIMIT 1`,
      [requestTypeId],
    );
    let formId;
    if (forms.length) {
      formId = forms[0].id;
      if (name) {
        await conn.query(`UPDATE itreq_form_definitions SET name = ? WHERE id = ?`, [name, formId]);
      }
    } else {
      const [{ insertId }] = await conn.query(
        `INSERT INTO itreq_form_definitions (request_type_id, name, version, is_active)
         VALUES (?, ?, 1, 1)`,
        [requestTypeId, name || 'ฟอร์ม'],
      );
      formId = insertId;
    }

    // Preserve field IDs when editing a form. Request values reference these IDs,
    // so deleting and recreating every field would cascade-delete historical data.
    const [existingFields] = await conn.query(
      `SELECT id, field_name FROM itreq_form_fields WHERE form_id = ?`,
      [formId],
    );
    const existingByName = new Map(existingFields.map((field) => [field.field_name, field.id]));
    const retainedIds = [];

    for (const field of normalizedFields) {
      const existingId = existingByName.get(field.field_name);
      const values = [
        field.field_label,
        field.field_type,
        field.options,
        field.placeholder,
        field.default_value,
        field.is_required,
        field.sort_order,
        field.validation,
      ];
      if (existingId) {
        await conn.query(
          `UPDATE itreq_form_fields
              SET field_label = ?, field_type = ?, options = ?, placeholder = ?,
                  default_value = ?, is_required = ?, sort_order = ?, validation = ?
            WHERE id = ? AND form_id = ?`,
          [...values, existingId, formId],
        );
        retainedIds.push(existingId);
      } else {
        const [{ insertId }] = await conn.query(
          `INSERT INTO itreq_form_fields
            (form_id, field_label, field_name, field_type, options, placeholder,
             default_value, is_required, sort_order, validation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [formId, field.field_label, field.field_name, field.field_type,
            field.options, field.placeholder, field.default_value,
            field.is_required, field.sort_order, field.validation],
        );
        retainedIds.push(insertId);
      }
    }

    if (retainedIds.length) {
      await conn.query(
        `DELETE FROM itreq_form_fields WHERE form_id = ? AND id NOT IN (?)`,
        [formId, retainedIds],
      );
    } else {
      await conn.query(`DELETE FROM itreq_form_fields WHERE form_id = ?`, [formId]);
    }

    // replace slots
    await conn.query(
      `DELETE FROM itreq_approval_slot_templates WHERE request_type_id = ?`,
      [requestTypeId],
    );
    if (normalizedSlots.length) {
      const rows = normalizedSlots.map((s, idx) => {
        const mode = s.mode;
        return [
          requestTypeId,
          s.step_no,
          s.slot_label || `ผู้อนุมัติ ${idx + 1}`,
          mode,
          s.fixed_emp_id,
          s.is_required,
          s.allow_skip,
          s.sign_stage,
        ];
      });
      await conn.query(
        `INSERT INTO itreq_approval_slot_templates
           (request_type_id, step_no, slot_label, mode, fixed_emp_id, is_required, allow_skip, sign_stage)
         VALUES ?`,
        [rows],
      );
    }

    await conn.commit();
    return await getFormDesign(requestTypeId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Reports / Dashboard ──────────────────────────────────────────────
export async function reportSummary({ from, to } = {}) {
  const where = [];
  const args = [];
  if (from) { where.push('r.created_at >= ?'); args.push(from); }
  if (to)   { where.push('r.created_at <= ?'); args.push(to); }
  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [byStatus] = await appDB.query(
    `SELECT r.status, COUNT(*) AS c FROM itreq_requests r ${wsql} GROUP BY r.status`,
    args,
  );

  const [byType] = await appDB.query(
    `SELECT t.id, t.name, COUNT(r.id) AS c
       FROM itreq_request_types t
       LEFT JOIN itreq_requests r ON r.request_type_id = t.id
            ${where.length ? `AND ${where.join(' AND ')}` : ''}
      GROUP BY t.id, t.name
      ORDER BY c DESC`,
    args,
  );

  const [byMonth] = await appDB.query(
    `SELECT DATE_FORMAT(r.created_at, '%Y-%m') AS ym, COUNT(*) AS c
       FROM itreq_requests r ${wsql}
      GROUP BY ym ORDER BY ym`,
    args,
  );

  const [byUrgency] = await appDB.query(
    `SELECT r.urgency, COUNT(*) AS c FROM itreq_requests r ${wsql} GROUP BY r.urgency`,
    args,
  );

  const [topRequesters] = await appDB.query(
    `SELECT r.requester_emp_id, COUNT(*) AS c
       FROM itreq_requests r ${wsql}
      GROUP BY r.requester_emp_id ORDER BY c DESC LIMIT 10`,
    args,
  );

  const [topApprovers] = await appDB.query(
    `SELECT s.approver_emp_id, COUNT(*) AS c
       FROM itreq_request_approval_steps s
       JOIN itreq_requests r ON r.id = s.request_id
      WHERE s.status = 'approved'
        ${where.length ? `AND ${where.join(' AND ')}` : ''}
      GROUP BY s.approver_emp_id ORDER BY c DESC LIMIT 10`,
    args,
  );

  const [avgApproval] = await appDB.query(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, r.submitted_at, r.completed_at)) AS avg_hours
       FROM itreq_requests r
      WHERE r.completed_at IS NOT NULL AND r.submitted_at IS NOT NULL
        ${where.length ? `AND ${where.join(' AND ')}` : ''}`,
    args,
  );

  const [total] = await appDB.query(`SELECT COUNT(*) AS c FROM itreq_requests r ${wsql}`, args);

  return {
    total: total[0].c,
    by_status: byStatus,
    by_type: byType,
    by_month: byMonth,
    by_urgency: byUrgency,
    top_requesters: topRequesters,
    top_approvers: topApprovers,
    avg_approval_hours: avgApproval[0]?.avg_hours ? Number(avgApproval[0].avg_hours).toFixed(1) : null,
  };
}

export async function listCompletedRequests({
  from, to, requestTypeId, requesterEmpId, urgency, status, q, limit = 500,
} = {}) {
  const allowedStatus = ['completed', 'closed'];
  const allowedUrgency = ['low', 'normal', 'high', 'urgent'];
  const where = [];
  const args = [];

  if (status && allowedStatus.includes(status)) {
    where.push('r.status = ?'); args.push(status);
  } else {
    where.push(`r.status IN ('completed','closed')`);
  }
  if (from) { where.push('r.created_at >= ?'); args.push(from); }
  if (to)   { where.push('r.created_at <= ?'); args.push(to); }
  if (requestTypeId) { where.push('r.request_type_id = ?'); args.push(Number(requestTypeId)); }
  if (requesterEmpId) { where.push('r.requester_emp_id = ?'); args.push(String(requesterEmpId)); }
  if (urgency && allowedUrgency.includes(urgency)) {
    where.push('r.urgency = ?'); args.push(urgency);
  }
  if (q) {
    where.push('(r.request_no LIKE ? OR r.title LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like);
  }
  args.push(Number(limit) || 500);

  const [rows] = await appDB.query(
    `SELECT r.id, r.request_no, r.requester_emp_id, r.title, r.urgency, r.status,
            r.submitted_at, r.completed_at, r.created_at,
            t.name AS request_type_name
       FROM itreq_requests r
       JOIN itreq_request_types t ON t.id = r.request_type_id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(r.completed_at, r.updated_at, r.created_at) DESC
      LIMIT ?`,
    args,
  );
  return rows;
}

// ── User Roles ───────────────────────────────────────────────────────
export async function listUserRoles() {
  const [rows] = await appDB.query(
    `SELECT id, emp_id, role, is_active, created_at FROM itreq_user_roles ORDER BY role, emp_id`,
  );
  return rows;
}

export async function upsertUserRole(empId, role) {
  await appDB.query(
    `INSERT INTO itreq_user_roles (emp_id, role, is_active)
       VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE is_active = 1`,
    [empId, role],
  );
}

export async function removeUserRole(empId, role) {
  await appDB.query(
    `DELETE FROM itreq_user_roles WHERE emp_id = ? AND role = ?`,
    [empId, role],
  );
}

// ── helpers ──────────────────────────────────────────────────────────
function safeJson(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

function normalizeFieldName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'field';
}

function normalizeAndValidateFields(fields) {
  if (!Array.isArray(fields)) throw httpError('fields_must_be_array');
  const allowedTypes = new Set(['text', 'textarea', 'dropdown', 'radio', 'checkbox', 'date', 'file', 'signature', 'number', 'email']);
  const names = new Set();

  return fields.map((f, idx) => {
    const fieldName = normalizeFieldName(f.field_name || `field_${idx + 1}`);
    if (names.has(fieldName)) throw httpError(`duplicate_field_name:${fieldName}`);
    names.add(fieldName);

    return {
      field_label: String(f.field_label || '').trim() || `Field ${idx + 1}`,
      field_name: fieldName,
      field_type: allowedTypes.has(f.field_type) ? f.field_type : 'text',
      options: f.options ? JSON.stringify(Array.isArray(f.options) ? f.options : [f.options]) : null,
      placeholder: f.placeholder || null,
      default_value: f.default_value || null,
      is_required: f.is_required ? 1 : 0,
      sort_order: idx + 1,
      validation: f.validation ? JSON.stringify(f.validation) : null,
    };
  });
}

function normalizeAndValidateSlots(slots) {
  if (!Array.isArray(slots)) throw httpError('slots_must_be_array');
  const allowedModes = new Set(['fixed', 'selectable', 'self', 'it_staff']);

  return slots.map((s, idx) => {
    const mode = allowedModes.has(s.mode) ? s.mode : 'selectable';
    const signStage = s.sign_stage || 'approval';
    if (!['approval', 'acceptance', 'completion'].includes(signStage)) throw httpError('invalid_sign_stage');
    if (mode === 'self' && signStage !== 'approval') throw httpError('self_requires_approval_stage');
    if (mode === 'fixed' && !String(s.fixed_emp_id || '').trim()) {
      throw httpError(`fixed_approver_required:step_${idx + 1}`);
    }

    return {
      step_no: idx + 1,
      slot_label: String(s.slot_label || '').trim() || `Approver ${idx + 1}`,
      mode,
      sign_stage: signStage,
      fixed_emp_id: mode === 'fixed' ? String(s.fixed_emp_id).trim() : null,
      is_required: s.is_required ? 1 : 0,
      allow_skip: s.allow_skip ? 1 : 0,
    };
  });
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}
