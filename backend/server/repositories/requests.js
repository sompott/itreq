import { appDB } from '../db.js';
import { getEmployeeById } from './employees.js';
import { getRequestTypeById } from './requestTypes.js';
import { getActiveFormByType, getApprovalSlotsByType } from './forms.js';
import { hasVisibleInkDataUrl, saveSignatureDataUrl } from './signatures.js';
import { listITSignatures } from './itSignatures.js';
import { canSignStep } from '../signingWorkflow.js';

export async function createRequest({
  requesterEmpId,
  requestTypeId,
  values = {},
  urgency = 'normal',
  selectedApprovers = {},
  requesterSignature = null,
  status = 'draft',
}) {
  requesterSignature = await verifyRequesterSignature(requesterEmpId, requesterSignature);
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();

    const form = await getActiveFormByType(requestTypeId);
    const slots = await getApprovalSlotsByType(requestTypeId);
    const requestType = await getRequestTypeById(requestTypeId);

    // Forms such as FM-IT-07 start with the requester's name. That value is
    // not a document title, so fall back to the request type when the form
    // has no explicit title/subject field.
    const title = pickTitle(values, form) || requestType?.name || '(ไม่ระบุหัวข้อ)';
    const detail = pickDetail(values, form) || null;

    const [{ insertId: requestId }] = [
      await conn.query(
        `INSERT INTO itreq_requests
           (request_no, requester_emp_id, request_type_id, title, detail, urgency, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          await nextRequestNo(conn, requestTypeId),
          requesterEmpId,
          requestTypeId,
          title,
          detail,
          urgency,
          status,
          status === 'pending' ? new Date() : null,
        ],
      ),
    ].map(([res]) => res);

    if (form?.fields?.length) {
      const fieldIdByName = new Map(form.fields.map((f) => [f.field_name, f.id]));
      const rows = [];
      for (const [key, val] of Object.entries(values)) {
        const fieldId = fieldIdByName.get(key);
        if (!fieldId) continue;
        const stored = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
        rows.push([requestId, fieldId, stored]);
      }
      if (rows.length) {
        await conn.query(
          `INSERT INTO itreq_form_values (request_id, field_id, field_value) VALUES ?`,
          [rows],
        );
      }
    }

    for (const slot of slots) {
      let approverEmpId;
      if (slot.mode === 'fixed') approverEmpId = slot.fixed_emp_id;
      else if (slot.mode === 'self') approverEmpId = requesterEmpId;
      else approverEmpId = selectedApprovers[slot.id];

      if (!approverEmpId && slot.mode !== 'it_staff') {
        if (slot.is_required) {
          throw Object.assign(new Error(`approver_required:${slot.slot_label}`), { httpStatus: 400 });
        }
        continue;
      }

      // self slot: ผู้ขอเซ็นตอนส่งคำขอเลย
      if (slot.mode === 'self' && requesterSignature?.data) {
        const rawData = requesterSignature.data;
        let sigFile = null;
        let sigDataForDB = rawData;
        if (typeof rawData === 'string' && rawData.startsWith('data:')) {
          sigFile = await saveSignatureDataUrl(rawData, `req${requestId}_step${slot.step_no}`);
          if (sigFile) sigDataForDB = null;
        }
        await conn.query(
          `INSERT INTO itreq_request_approval_steps
             (request_id, step_no, slot_label, approver_emp_id, status,
              signature_type, signature_data, signature_file, signed_at, sign_stage, signer_mode)
           VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, NOW(), ?, ?)`,
          [requestId, slot.step_no, slot.slot_label, approverEmpId,
           requesterSignature.type || 'draw', sigDataForDB, sigFile, slot.sign_stage || 'approval', slot.mode],
        );
      } else {
        // ไม่เซ็ต email_sent_at ตรงนี้ — ปล่อยให้ workflow ส่งอีเมลตามลำดับ
        // (ดู notifyNextPendingStep ใน server/index.js)
        await conn.query(
          `INSERT INTO itreq_request_approval_steps
             (request_id, step_no, slot_label, approver_emp_id, status, sign_stage, signer_mode)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
          [requestId, slot.step_no, slot.slot_label, approverEmpId || null, slot.sign_stage || 'approval', slot.mode],
        );
      }
    }

    if (status === 'pending') {
      const [[{ remaining }]] = await conn.query(`SELECT COUNT(*) AS remaining FROM itreq_request_approval_steps
        WHERE request_id = ? AND sign_stage = 'approval' AND status = 'pending'`, [requestId]);
      if (!remaining) {
        await conn.query("UPDATE itreq_requests SET status = 'approved' WHERE id = ?", [requestId]);
      }
    }

    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, to_status, note)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, status === 'pending' ? 'submit' : 'draft', requesterEmpId, status, null],
    );

    await conn.commit();
    return await getRequestById(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listRequests({ requesterEmpId, status, limit = 100 } = {}) {
  const where = [];
  const args = [];
  if (requesterEmpId) {
    where.push('r.requester_emp_id = ?');
    args.push(requesterEmpId);
  }
  if (status) {
    where.push('r.status = ?');
    args.push(status);
  }
  const sql = `
    SELECT r.id, r.request_no, r.requester_emp_id, r.request_type_id, r.title,
           r.detail, r.urgency, r.status, r.submitted_at, r.created_at, r.updated_at,
           t.name AS request_type_name
    FROM itreq_requests r
    JOIN itreq_request_types t ON t.id = r.request_type_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.created_at DESC
    LIMIT ?
  `;
  args.push(Number(limit));
  const [rows] = await appDB.query(sql, args);
  return rows;
}

export async function getRequestById(id) {
  const [rows] = await appDB.query(
    `SELECT r.*, t.name AS request_type_name
     FROM itreq_requests r
     JOIN itreq_request_types t ON t.id = r.request_type_id
     WHERE r.id = ? LIMIT 1`,
    [id],
  );
  if (!rows.length) return null;
  const request = rows[0];
  request.requester = await getEmployeeById(request.requester_emp_id);

  const [vals] = await appDB.query(
    `SELECT ff.id AS field_id, fv.field_value,
            ff.field_name, ff.field_label, ff.field_type, ff.options,
            ff.placeholder, ff.is_required, ff.sort_order, ff.validation
       FROM itreq_form_definitions fd
       JOIN itreq_form_fields ff ON ff.form_id = fd.id
       LEFT JOIN itreq_form_values fv
         ON fv.field_id = ff.id AND fv.request_id = ?
      WHERE fd.request_type_id = ? AND fd.is_active = 1
     ORDER BY ff.sort_order, ff.id`,
    [id, request.request_type_id],
  );
  request.field_entries = vals.map((v) => ({
    field_name: v.field_name,
    field_label: v.field_label,
    field_type: v.field_type,
    options: safeJson(v.options) || [],
    placeholder: v.placeholder,
    is_required: !!v.is_required,
    validation: safeJson(v.validation),
    value: v.field_value,
  }));
  hydrateMissingFormValues(request);
  request.values = Object.fromEntries(
    request.field_entries.map((field) => [field.field_name, field.value ?? '']),
  );

  // Correct requests created by the old fallback, which used the first text
  // field (often the requester's name) as the document title.
  const fakeForm = { fields: vals };
  const explicitTitle = pickTitle(request.values, fakeForm);
  const firstTextField = vals.find(
    (field) => ['text', 'textarea'].includes(field.field_type) && request.values[field.field_name],
  );
  const legacyAutoTitle = !explicitTitle
    && firstTextField
    && String(request.title || '').trim() === String(request.values[firstTextField.field_name] || '').trim();
  if (explicitTitle) {
    request.title = explicitTitle;
  } else if (!request.title || request.title === '(ไม่ระบุหัวข้อ)' || legacyAutoTitle) {
    request.title = request.request_type_name || '(ไม่ระบุหัวข้อ)';
  }
  if (!request.detail) {
    const d = pickDetail(request.values, fakeForm);
    if (d) request.detail = d;
  }

  const [steps] = await appDB.query(
    `SELECT id, step_no, slot_label, approver_emp_id, status,
            signature_type, signature_data, signature_file,
            comment, signed_at, email_sent_at, sign_stage, signer_mode
     FROM itreq_request_approval_steps
     WHERE request_id = ?
     ORDER BY step_no`,
    [id],
  );
  request.approval_steps = [];
  for (const s of steps) {
    // signature_url: ถ้ามีไฟล์บน NAS ใช้ URL ของ endpoint, ไม่งั้น fallback ไปที่ data URL เดิม
    const signatureUrl = s.signature_file
      ? `/itrequest/api/signatures/${encodeURIComponent(s.signature_file)}`
      : (s.signature_data || null);
    request.approval_steps.push({
      ...s,
      signature_url: signatureUrl,
      approver: s.approver_emp_id ? await getEmployeeById(s.approver_emp_id) : null,
    });
  }

  request.it_signatures = await listITSignatures(id);
  request.request_type = await getRequestTypeById(request.request_type_id);
  return request;
}

// ลายเซ็นของผู้ขอ (ช่อง self) — ห้ามเชื่อ URL ที่เบราว์เซอร์ส่งมา
// fetch → ใช้รูปลายเซ็นที่ลงทะเบียนของผู้ขอเท่านั้น, draw → ต้องมีหมึกจริง
async function verifyRequesterSignature(requesterEmpId, signature) {
  if (!signature?.data) return null;
  if (signature.type === 'fetch') {
    const requester = await getEmployeeById(requesterEmpId);
    if (!requester?.has_signature || !requester.signature_url) {
      throw Object.assign(new Error('requester_signature_not_registered'), { httpStatus: 400 });
    }
    return { type: 'fetch', data: requester.signature_url };
  }
  if (!hasVisibleInkDataUrl(signature.data)) {
    throw Object.assign(new Error('signature_blank'), { httpStatus: 400 });
  }
  return { type: 'draw', data: signature.data };
}

export async function approveStep({ requestId, stepNo, approverEmpId, signatureType, signatureData, comment, isITStaff = false }) {
  const approver = await getEmployeeById(approverEmpId);
  if (signatureType === 'fetch') {
    if (!approver?.has_signature || !approver.signature_url) {
      throw Object.assign(new Error('approver_signature_not_registered'), { httpStatus: 400 });
    }
    // Never trust a signature URL supplied by the browser.
    signatureData = approver.signature_url;
  } else {
    signatureType = 'draw';
    if (!hasVisibleInkDataUrl(signatureData)) {
      throw Object.assign(new Error('signature_blank'), { httpStatus: 400 });
    }
  }

  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();

    const [[requestState]] = await conn.query('SELECT status FROM itreq_requests WHERE id = ? FOR UPDATE', [requestId]);
    const [allSteps] = await conn.query('SELECT * FROM itreq_request_approval_steps WHERE request_id = ? ORDER BY step_no', [requestId]);
    const targetStep = allSteps.find((step) => step.step_no === stepNo);
    if (!requestState || !targetStep || !canSignStep({ step: targetStep, steps: allSteps,
      requestStatus: requestState.status, empId: approverEmpId, isITStaff })) {
      throw Object.assign(new Error('step_not_ready_or_not_authorized'), { httpStatus: 409 });
    }

    // กันไม่ให้ approve ข้ามลำดับ — ต้องไม่มีขั้นก่อนหน้าที่ยัง pending อยู่
    const [[earlier]] = await conn.query(
      `SELECT step_no FROM itreq_request_approval_steps
        WHERE request_id = ? AND step_no < ? AND status = 'pending' AND sign_stage = ?
        ORDER BY step_no LIMIT 1`,
      [requestId, stepNo, targetStep.sign_stage],
    );
    if (earlier) {
      throw Object.assign(
        new Error(`previous_step_pending:${earlier.step_no}`),
        { httpStatus: 400 },
      );
    }

    let signatureFile = null;
    let signatureDataForDB = signatureData;
    if (signatureType === 'draw') {
      signatureFile = await saveSignatureDataUrl(signatureData, `req${requestId}_step${stepNo}`);
      if (!signatureFile) throw Object.assign(new Error('signature_invalid'), { httpStatus: 400 });
      signatureDataForDB = null;
    }

    const [result] = await conn.query(
      `UPDATE itreq_request_approval_steps
         SET status = 'approved',
             signature_type = ?,
             signature_data = ?,
             signature_file = ?,
             comment = ?,
             signed_at = NOW()
             , approver_emp_id = ?
       WHERE request_id = ? AND step_no = ? AND status = 'pending'`,
      [signatureType, signatureDataForDB, signatureFile, comment || null, approverEmpId, requestId, stepNo],
    );
    if (result.affectedRows === 0) {
      throw Object.assign(new Error('step_not_found_or_not_pending'), { httpStatus: 404 });
    }
    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, note)
       VALUES (?, 'approve', ?, ?)`,
      [requestId, approverEmpId, comment || null],
    );

    const [[{ pending_count }]] = await conn.query(
      `SELECT COUNT(*) AS pending_count FROM itreq_request_approval_steps
       WHERE request_id = ? AND status = 'pending' AND sign_stage = 'approval'`,
      [requestId],
    );
    if (pending_count === 0 && requestState.status === 'pending') {
      await conn.query(`UPDATE itreq_requests SET status = 'approved' WHERE id = ?`, [requestId]);
    }

    await conn.commit();
    return await getRequestById(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function rejectStep({ requestId, stepNo, approverEmpId, comment }) {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query('SELECT status FROM itreq_requests WHERE id = ? FOR UPDATE', [requestId]);
    const [steps] = await conn.query('SELECT * FROM itreq_request_approval_steps WHERE request_id = ?', [requestId]);
    const step = steps.find((item) => item.step_no === stepNo);
    if (!request || !step || step.sign_stage !== 'approval'
      || !canSignStep({ step, steps, requestStatus: request.status, empId: approverEmpId })) {
      throw Object.assign(new Error('step_not_ready_or_not_authorized'), { httpStatus: 409 });
    }
    const [result] = await conn.query(
      `UPDATE itreq_request_approval_steps
         SET status = 'rejected', comment = ?, signed_at = NOW()
       WHERE request_id = ? AND step_no = ? AND approver_emp_id = ? AND status = 'pending'`,
      [comment || null, requestId, stepNo, approverEmpId],
    );
    if (result.affectedRows === 0) {
      throw Object.assign(new Error('step_not_found_or_not_pending'), { httpStatus: 404 });
    }
    await conn.query(`UPDATE itreq_requests SET status = 'rejected' WHERE id = ?`, [requestId]);
    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, note)
       VALUES (?, 'reject', ?, ?)`,
      [requestId, approverEmpId, comment || null],
    );
    await conn.commit();
    return await getRequestById(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function returnStepForRevision({ requestId, approverEmpId, comment }) {
  if (!String(comment || '').trim()) {
    throw Object.assign(new Error('return_comment_required'), { httpStatus: 400 });
  }
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      'SELECT status FROM itreq_requests WHERE id = ? FOR UPDATE',
      [requestId],
    );
    if (!request) throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    if (!['pending', 'approved', 'in_progress', 'completed'].includes(request.status)) {
      throw Object.assign(new Error('request_not_returnable'), { httpStatus: 409 });
    }

    await conn.query(
      `UPDATE itreq_requests
          SET status = 'returned', completed_at = NULL, closed_at = NULL
        WHERE id = ?`,
      [requestId],
    );
    await resetWorkflowAfterReturn(conn, requestId);
    await conn.query(
      `INSERT INTO itreq_request_logs
         (request_id, action, actor_emp_id, from_status, to_status, note)
       VALUES (?, 'return_for_revision', ?, ?, 'returned', ?)`,
      [requestId, approverEmpId, request.status, String(comment).trim()],
    );
    await conn.commit();
    return await getRequestById(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateRequestFormValues({ requestId, values = {}, actorEmpId, isAdmin = false }) {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      `SELECT id, requester_emp_id, request_type_id, status
         FROM itreq_requests WHERE id = ? FOR UPDATE`,
      [requestId],
    );
    if (!request) throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    const requesterCanEdit = request.requester_emp_id === actorEmpId && ['draft', 'returned'].includes(request.status);
    const adminCanEdit = isAdmin && !['cancelled', 'closed'].includes(request.status);
    if (!requesterCanEdit && !adminCanEdit) {
      throw Object.assign(new Error('request_not_editable'), { httpStatus: 409 });
    }

    const [fields] = await conn.query(
      `SELECT ff.id, ff.field_name, ff.field_type, ff.validation
         FROM itreq_form_definitions fd
         JOIN itreq_form_fields ff ON ff.form_id = fd.id
        WHERE fd.request_type_id = ? AND fd.is_active = 1`,
      [request.request_type_id],
    );
    const fieldByName = new Map(fields.map((field) => [field.field_name, {
      ...field,
      validation: safeJson(field.validation) || {},
    }]));
    const rows = [];
    for (const [name, value] of Object.entries(values || {})) {
      const field = fieldByName.get(name);
      if (!field) continue;
      if (!isAdmin && field.validation.fill_stage === 'it_after_approval') continue;
      const stored = typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '');
      rows.push([requestId, field.id, stored]);
    }
    if (rows.length) {
      await conn.query(
        `INSERT INTO itreq_form_values (request_id, field_id, field_value)
         VALUES ?
         ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
        [rows],
      );
    }

    const form = await getActiveFormByType(request.request_type_id);
    const [storedRows] = await conn.query(
      `SELECT ff.field_name, fv.field_value
         FROM itreq_form_values fv
         JOIN itreq_form_fields ff ON ff.id = fv.field_id
        WHERE fv.request_id = ?`,
      [requestId],
    );
    const mergedValues = Object.fromEntries(storedRows.map((row) => [row.field_name, row.field_value]));
    const type = await getRequestTypeById(request.request_type_id);
    const title = pickTitle(mergedValues, form) || type?.name || '(ไม่ระบุหัวข้อ)';
    const detail = pickDetail(mergedValues, form) || null;
    const nextStatus = request.status;
    await conn.query(
      `UPDATE itreq_requests SET title = ?, detail = ?, status = ? WHERE id = ?`,
      [title, detail, nextStatus, requestId],
    );
    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, from_status, to_status, note)
       VALUES (?, 'edit_form_values', ?, ?, ?, ?)`,
      [requestId, actorEmpId, request.status, nextStatus, isAdmin ? 'admin edited request form' : 'requester edited returned form'],
    );
    await conn.commit();
    return await getRequestById(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function resubmitReturnedRequest({ requestId, actorEmpId, isAdmin = false }) {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      `SELECT id, requester_emp_id, status FROM itreq_requests WHERE id = ? FOR UPDATE`,
      [requestId],
    );
    if (!request) throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    if (request.status !== 'returned') {
      throw Object.assign(new Error('request_not_returned'), { httpStatus: 409 });
    }
    if (!isAdmin && request.requester_emp_id !== actorEmpId) {
      throw Object.assign(new Error('not_owner'), { httpStatus: 403 });
    }
    await conn.query(
      `UPDATE itreq_requests SET status = 'pending', submitted_at = NOW() WHERE id = ?`,
      [requestId],
    );
    await resetNonRequesterApprovalSteps(conn, requestId);
    await conn.query(
      `INSERT INTO itreq_request_logs
         (request_id, action, actor_emp_id, from_status, to_status, note)
       VALUES (?, 'resubmit', ?, 'returned', 'pending', 'resubmitted after revision')`,
      [requestId, actorEmpId],
    );
    await conn.commit();
    return await getRequestById(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function resetNonRequesterApprovalSteps(conn, requestId) {
  await conn.query(
    `UPDATE itreq_request_approval_steps
        SET status = 'pending', signature_type = NULL, signature_data = NULL,
            signature_file = NULL, comment = NULL, signed_at = NULL, email_sent_at = NULL
      WHERE request_id = ? AND sign_stage = 'approval' AND signer_mode <> 'self'`,
    [requestId],
  );
}

async function resetWorkflowAfterReturn(conn, requestId) {
  await conn.query(
    `UPDATE itreq_request_approval_steps
        SET status = 'pending', signature_type = NULL, signature_data = NULL,
            signature_file = NULL, comment = NULL, signed_at = NULL, email_sent_at = NULL
      WHERE request_id = ? AND signer_mode <> 'self'`,
    [requestId],
  );
  await conn.query(
    `DELETE FROM itreq_request_it_signatures WHERE request_id = ?`,
    [requestId],
  );
}

/**
 * เปลี่ยนสถานะคำขอ (สำหรับ IT staff workflow: in_progress / completed / closed)
 */
export async function updateRequestStatus({ requestId, status, actorEmpId, note }) {
  const allowed = ['in_progress', 'completed', 'closed', 'cancelled'];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error(`invalid_status:${status}`), { httpStatus: 400 });
  }
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();

    const [[current]] = await conn.query(
      `SELECT r.status, t.it_acceptance_required, t.it_completion_required
         FROM itreq_requests r JOIN itreq_request_types t ON t.id = r.request_type_id
        WHERE r.id = ? FOR UPDATE`,
      [requestId],
    );
    if (!current) {
      throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    }

    const previousStatus = { in_progress: 'approved', completed: 'in_progress', closed: 'completed' }[status];
    if (previousStatus && current.status !== previousStatus) {
      throw Object.assign(new Error('invalid_status_transition'), { httpStatus: 409 });
    }
    const phase = { in_progress: 'acceptance', closed: 'completion' }[status];
    if (phase) {
      const [[pending]] = await conn.query(`SELECT id FROM itreq_request_approval_steps
        WHERE request_id = ? AND sign_stage = ? AND status = 'pending' LIMIT 1`, [requestId, phase]);
      if (pending) throw Object.assign(new Error(`it_signature_required:${phase}`), { httpStatus: 409 });
    }
    const [[{ stage_count }]] = await conn.query(`SELECT COUNT(*) AS stage_count FROM itreq_request_approval_steps
      WHERE request_id = ? AND sign_stage <> 'approval'`, [requestId]);
    // Requests created before the slot migration keep their original IT signature records.
    if (!stage_count && phase && current[`it_${phase}_required`]) {
      const [[signature]] = await conn.query(
        'SELECT id FROM itreq_request_it_signatures WHERE request_id = ? AND phase = ?',
        [requestId, phase],
      );
      if (!signature) throw Object.assign(new Error(`it_signature_required:${phase}`), { httpStatus: 409 });
    }

    const fields = ['status = ?'];
    const args = [status];
    if (status === 'completed') {
      fields.push('completed_at = NOW()');
    }
    if (status === 'closed') {
      fields.push('closed_at = NOW()');
    }
    args.push(requestId);

    await conn.query(`UPDATE itreq_requests SET ${fields.join(', ')} WHERE id = ?`, args);

    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, from_status, to_status, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, status, actorEmpId, current.status, status, note || null],
    );

    await conn.commit();
    return await getRequestById(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function upsertRequestFieldValues({ requestId, values = {}, actorEmpId }) {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      `SELECT id, status FROM itreq_requests WHERE id = ? LIMIT 1`,
      [requestId],
    );
    if (!request) {
      throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    }

    const fieldNames = Object.keys(values || {});
    if (fieldNames.length) {
      const [fields] = await conn.query(
        `SELECT ff.id, ff.field_name, ff.validation
           FROM itreq_form_fields ff
           JOIN itreq_form_definitions fd ON fd.id = ff.form_id
           JOIN itreq_requests r ON r.request_type_id = fd.request_type_id
          WHERE r.id = ? AND fd.is_active = 1`,
        [requestId],
      );
      const fieldByName = new Map(fields.map((f) => [f.field_name, f]));
      const rows = [];
      for (const [name, value] of Object.entries(values)) {
        const field = fieldByName.get(name);
        if (!field) continue;
        const validation = safeJson(field.validation) || {};
        if (validation.fill_stage !== 'it_after_approval') continue;
        const stored = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
        rows.push([requestId, field.id, stored]);
      }
      if (rows.length) {
        await conn.query(
          `INSERT INTO itreq_form_values (request_id, field_id, field_value)
           VALUES ?
           ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
          [rows],
        );
      }
    }

    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, note)
       VALUES (?, 'update_it_fields', ?, ?)`,
      [requestId, actorEmpId, 'update IT-filled fields'],
    );

    await conn.commit();
    return await getRequestById(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


/**
 * รายการที่รอ approve โดย empCode
 * — แสดงเฉพาะ step ที่ "ถึงคิว" จริง ๆ (ไม่มี step ก่อนหน้าที่ยัง pending)
 */
export async function listPendingApprovals(empCode, isITStaff = false) {
  const [rows] = await appDB.query(
    `SELECT r.id, r.request_no, r.title, r.urgency, r.status, r.created_at,
            t.name AS request_type_name,
            s.step_no, s.slot_label, s.status AS step_status, s.email_sent_at,
            r.requester_emp_id
       FROM itreq_request_approval_steps s
       JOIN itreq_requests r ON r.id = s.request_id
       JOIN itreq_request_types t ON t.id = r.request_type_id
      WHERE (s.approver_emp_id = ? OR (? = 1 AND s.signer_mode = 'it_staff' AND s.approver_emp_id IS NULL))
        AND s.status = 'pending'
        AND r.status = CASE s.sign_stage WHEN 'approval' THEN 'pending' WHEN 'acceptance' THEN 'approved' ELSE 'completed' END
        AND NOT EXISTS (
          SELECT 1 FROM itreq_request_approval_steps s2
           WHERE s2.request_id = s.request_id
             AND s2.step_no < s.step_no
             AND s2.sign_stage = s.sign_stage
             AND s2.status = 'pending'
        )
      ORDER BY r.urgency DESC, r.created_at DESC`,
    [empCode, isITStaff ? 1 : 0],
  );
  return rows;
}

/**
 * รายการขั้นตอนการอนุมัติสำหรับหน้าติดตามการเซ็น
 * - admin เห็นทุกขั้นของคำขอที่ส่งแล้ว
 * - ผู้ใช้ทั่วไปเห็นทุกขั้นที่มอบหมายให้ตัวเอง รวมทั้งประวัติที่ดำเนินการแล้ว
 */
export async function listApprovalActivity({ empCode, isAdmin = false, isITStaff = false }) {
  const where = ["r.status <> 'draft'"];
  const args = [];
  if (!isAdmin) {
    where.push("(s.approver_emp_id = ? OR (? = 1 AND s.signer_mode = 'it_staff' AND s.approver_emp_id IS NULL))");
    args.push(empCode, isITStaff ? 1 : 0);
  }

  const [rows] = await appDB.query(
    `SELECT r.id, r.request_no, r.title, r.urgency, r.status, r.created_at,
            r.requester_emp_id, t.name AS request_type_name,
            s.id AS approval_step_id, s.step_no, s.slot_label,
            s.approver_emp_id, s.status AS step_status, s.signed_at, s.comment, s.sign_stage,
            CASE
              WHEN r.status = CASE s.sign_stage WHEN 'approval' THEN 'pending' WHEN 'acceptance' THEN 'approved' ELSE 'completed' END
                AND s.status = 'pending' AND NOT EXISTS (
                SELECT 1 FROM itreq_request_approval_steps earlier
                 WHERE earlier.request_id = s.request_id
                   AND earlier.step_no < s.step_no
                   AND earlier.sign_stage = s.sign_stage
                   AND earlier.status = 'pending'
              ) THEN 1 ELSE 0
            END AS is_current
       FROM itreq_request_approval_steps s
       JOIN itreq_requests r ON r.id = s.request_id
       JOIN itreq_request_types t ON t.id = r.request_type_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.created_at DESC, s.step_no ASC
      LIMIT 1000`,
    args,
  );

  const empIds = [...new Set(rows.flatMap((row) => [row.requester_emp_id, row.approver_emp_id]).filter(Boolean))];
  const employeePairs = await Promise.all(empIds.map(async (id) => {
    try {
      return [id, await getEmployeeById(id)];
    } catch {
      return [id, null];
    }
  }));
  const employees = new Map(employeePairs);

  return rows.map((row) => {
    const requester = employees.get(row.requester_emp_id);
    const approver = employees.get(row.approver_emp_id);
    return {
      ...row,
      is_current: Boolean(row.is_current),
      requester_name: requester?.name || row.requester_emp_id,
      requester_department: requester?.department || null,
      approver_name: approver?.name || row.approver_emp_id || 'เจ้าหน้าที่ IT ที่รับงาน',
      approver_department: approver?.department || null,
    };
  });
}

/**
 * หา step ถัดไปที่รอ approve (step_no น้อยที่สุดที่ status='pending')
 * ใช้สำหรับส่งอีเมลแจ้งผู้อนุมัติคนถัดไป
 */
export async function getNextPendingStep(requestId) {
  const [rows] = await appDB.query(
    `SELECT s.id, s.step_no, s.slot_label, s.approver_emp_id, s.email_sent_at, s.signer_mode, s.sign_stage
       FROM itreq_request_approval_steps s JOIN itreq_requests r ON r.id = s.request_id
      WHERE s.request_id = ? AND s.status = 'pending'
        AND r.status = CASE s.sign_stage WHEN 'approval' THEN 'pending' WHEN 'acceptance' THEN 'approved' ELSE 'completed' END
      ORDER BY s.step_no LIMIT 1`,
    [requestId],
  );
  return rows[0] || null;
}

/**
 * บันทึกเวลาที่ส่งอีเมลแจ้ง step นั้น ๆ
 */
export async function markStepEmailed(stepId) {
  await appDB.query(
    `UPDATE itreq_request_approval_steps SET email_sent_at = NOW() WHERE id = ?`,
    [stepId],
  );
}

/**
 * ยกเลิกคำขอ (ผู้ขอเอง หรือ admin)
 */
export async function cancelRequest({ requestId, actorEmpId, isAdmin = false, note }) {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, requester_emp_id, status FROM itreq_requests WHERE id = ? LIMIT 1`,
      [requestId],
    );
    if (!current) {
      throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    }
    if (!isAdmin && current.requester_emp_id !== actorEmpId) {
      throw Object.assign(new Error('not_owner'), { httpStatus: 403 });
    }
    if (!['draft', 'pending', 'returned'].includes(current.status)) {
      throw Object.assign(
        new Error(`cannot_cancel_status:${current.status}`),
        { httpStatus: 400 },
      );
    }

    await conn.query(
      `UPDATE itreq_requests SET status = 'cancelled' WHERE id = ?`,
      [requestId],
    );
    // step ที่ยัง pending → mark เป็น skipped (จะไม่ขึ้น list รออนุมัติ)
    await conn.query(
      `UPDATE itreq_request_approval_steps
          SET status = 'skipped'
        WHERE request_id = ? AND status = 'pending'`,
      [requestId],
    );
    await conn.query(
      `INSERT INTO itreq_request_logs
         (request_id, action, actor_emp_id, from_status, to_status, note)
       VALUES (?, 'cancel', ?, ?, 'cancelled', ?)`,
      [requestId, actorEmpId, current.status, note || null],
    );

    await conn.commit();
    return await getRequestById(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteRequest({ requestId, actorEmpId }) {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      `SELECT id, request_no FROM itreq_requests WHERE id = ? LIMIT 1`,
      [requestId],
    );
    if (!current) {
      throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    }
    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, note)
       VALUES (?, 'admin_delete', ?, ?)`,
      [requestId, actorEmpId, `deleted ${current.request_no}`],
    );
    await conn.query(`DELETE FROM itreq_requests WHERE id = ?`, [requestId]);
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * รายการที่รอ IT ดำเนินการ (สำหรับ IT Staff queue)
 */
export async function listITQueue() {
  const [rows] = await appDB.query(
    `SELECT r.id, r.request_no, r.title, r.urgency, r.status,
            r.requester_emp_id, r.created_at,
            t.name AS request_type_name
       FROM itreq_requests r
       JOIN itreq_request_types t ON t.id = r.request_type_id
      WHERE r.status IN ('approved','in_progress','completed')
      ORDER BY FIELD(r.status,'in_progress','approved','completed'),
               FIELD(r.urgency,'urgent','high','normal','low'),
               r.created_at`,
  );
  return rows;
}

/**
 * Log ทั้งหมดของ 1 คำขอ (สำหรับหน้า "ติดตาม")
 */
export async function getRequestLogs(requestId) {
  const [rows] = await appDB.query(
    `SELECT id, action, actor_emp_id, from_status, to_status, note, created_at
       FROM itreq_request_logs WHERE request_id = ? ORDER BY created_at`,
    [requestId],
  );
  const actors = new Map();
  for (const row of rows) {
    if (!row.actor_emp_id || actors.has(row.actor_emp_id)) continue;
    try {
      actors.set(row.actor_emp_id, await getEmployeeById(row.actor_emp_id));
    } catch {
      actors.set(row.actor_emp_id, null);
    }
  }
  return rows.map((row) => ({
    ...row,
    actor: row.actor_emp_id ? actors.get(row.actor_emp_id) || null : null,
  }));
}

/**
 * เลือก "หัวข้อ" จาก values + form definition
 * 1) ดู field_name มาตรฐาน: title / subject / topic / heading
 * 2) ดู field_label ที่มีคำว่า "หัวข้อ" / "title" / "subject" / "เรื่อง"
 */
function pickTitle(values, form) {
  if (!values) return null;
  for (const key of ['title', 'subject', 'topic', 'heading']) {
    if (values[key]) return String(values[key]).trim();
  }
  if (form?.fields) {
    const titleField = form.fields.find((f) => {
      const lbl = (f.field_label || '').trim();
      return /หัวข้อ|^เรื่อง|ชื่อโปรแกรม|^title$|^subject$|^topic$/i.test(lbl);
    });
    if (titleField && values[titleField.field_name]) {
      return String(values[titleField.field_name]).trim();
    }
  }
  return null;
}

function pickDetail(values, form) {
  if (!values) return null;
  for (const key of ['detail', 'description', 'note', 'remark']) {
    if (values[key]) return String(values[key]).trim();
  }
  if (form?.fields) {
    const detailField = form.fields.find((f) => {
      const lbl = (f.field_label || '').trim();
      return /รายละเอียด|คำอธิบาย|วัตถุประสงค์|^detail$|description/i.test(lbl);
    });
    if (detailField && values[detailField.field_name]) {
      return String(values[detailField.field_name]).trim();
    }
  }
  return null;
}

/**
 * Historical requests can outlive a form edit. Older versions of the form
 * editor recreated field IDs, which cascaded their stored values. Recover
 * deterministic values from request columns and the employee directory so
 * both the detail screen and Word templates remain useful.
 */
function hydrateMissingFormValues(request) {
  const entries = request.field_entries || [];
  const requester = request.requester || {};
  const employeeValueKeys = {
    name: 'name',
    department: 'department',
    phone: 'phone',
    emp_id: 'emp_id',
    position: 'position',
    section: 'section',
    email: 'email',
    nickname: 'nickname',
  };

  for (const field of entries) {
    if (field.value !== null && field.value !== undefined && String(field.value) !== '') continue;
    const validation = field.validation || {};
    if (validation.source !== 'employees') continue;
    const requesterKey = employeeValueKeys[validation.source_value || 'name'];
    if (requesterKey && requester[requesterKey] != null) {
      field.value = String(requester[requesterKey]);
    }
  }

  if (!request.detail) return;
  const hasStoredDetail = entries.some((field) =>
    field.field_type === 'textarea' && String(field.value || '').trim());
  if (hasStoredDetail) return;

  const requesterTextareas = entries.filter((field) =>
    field.field_type === 'textarea'
    && field.validation?.fill_stage !== 'it_after_approval');
  const detailField = requesterTextareas.find((field) =>
    /รายละเอียด|วัตถุประสงค์|ลักษณะปัญหา|อาการที่พบ|detail|description|purpose/i
      .test(field.field_label || field.field_name))
    || (requesterTextareas.length === 1 ? requesterTextareas[0] : null);
  if (detailField) detailField.value = String(request.detail);
}

async function nextRequestNo(conn, requestTypeId) {
  const settings = await getRequestNoSettings(conn, requestTypeId);
  if (settings.mode !== 'legacy') {
    return nextConfiguredRequestNo(conn, settings);
  }
  const year = new Date().getFullYear();
  const [[{ next }]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(request_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next
     FROM itreq_requests
     WHERE request_no LIKE ?`,
    [`REQ-${year}-%`],
  );
  return `REQ-${year}-${String(next).padStart(5, '0')}`;
}

export async function getRequestNoConfig() {
  return await getRequestNoSettings(appDB);
}

export async function saveRequestNoConfig(config) {
  const settings = normalizeRequestNoSettings(config);
  await appDB.query(
    `INSERT INTO itreq_settings (setting_key, setting_value)
       VALUES ('request_no_config', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [JSON.stringify(settings)],
  );
  return settings;
}

export async function getRequestTypeRequestNoConfig(requestTypeId) {
  return await getRequestNoSettings(appDB, requestTypeId);
}

export async function saveRequestTypeRequestNoConfig(requestTypeId, config) {
  const settings = normalizeRequestNoSettings(config);
  try {
    await appDB.query(
      `INSERT INTO itreq_request_no_configs
         (request_type_id, mode, pattern, sequence_digits, reset_period)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         mode = VALUES(mode),
         pattern = VALUES(pattern),
         sequence_digits = VALUES(sequence_digits),
         reset_period = VALUES(reset_period)`,
      [requestTypeId, settings.mode, settings.pattern, settings.sequence_digits, settings.reset_period],
    );
  } catch (err) {
    if (isMissingRequestNoConfigTable(err)) {
      throw Object.assign(new Error('request_no_config_table_missing_run_migration'), { httpStatus: 500 });
    }
    throw err;
  }
  return settings;
}

async function getRequestNoSettings(db, requestTypeId = null) {
  if (requestTypeId) {
    try {
      const [rows] = await db.query(
        `SELECT mode, pattern, sequence_digits, reset_period
           FROM itreq_request_no_configs
          WHERE request_type_id = ?
          LIMIT 1`,
        [requestTypeId],
      );
      if (rows.length) return normalizeRequestNoSettings(rows[0]);
      return defaultRequestNoSettings();
    } catch (err) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(err?.code)) throw err;
      return defaultRequestNoSettings();
    }
  }
  try {
    const [rows] = await db.query(
      `SELECT setting_value FROM itreq_settings WHERE setting_key = 'request_no_config' LIMIT 1`,
    );
    if (!rows.length) return defaultRequestNoSettings();
    return normalizeRequestNoSettings(safeJson(rows[0].setting_value));
  } catch (err) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(err?.code)) {
      return defaultRequestNoSettings();
    }
    throw err;
  }
}

function isMissingRequestNoConfigTable(err) {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(err?.code);
}

function defaultRequestNoSettings() {
  const defaultPattern = 'REQ-{BYYYY}-{SEQ}';
  return {
    mode: 'legacy',
    pattern: defaultPattern,
    sequence_digits: 3,
    reset_period: 'year',
  };
}

function normalizeRequestNoSettings(input = {}) {
  const defaultPattern = 'REQ-{BYYYY}-{SEQ}';
  const mode = input.mode === 'custom' ? 'custom' : 'legacy';
  const sequenceDigits = Math.min(8, Math.max(1, Number(input.sequence_digits) || 3));
  const resetPeriod = ['month', 'year', 'never'].includes(input.reset_period) ? input.reset_period : 'year';
  const pattern = mode === 'legacy'
    ? defaultPattern
    : String(input.pattern || defaultPattern).trim() || defaultPattern;
  return {
    mode,
    pattern,
    sequence_digits: sequenceDigits,
    reset_period: resetPeriod,
  };
}

async function nextConfiguredRequestNo(conn, settings) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const buddhistYear = now.getFullYear() + 543;
  const byyyy = String(buddhistYear);
  const byy = String(buddhistYear).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const marker = '__SEQ__';
  const prefix = renderRequestNoPattern(settings.pattern, {
    YYYY: yyyy,
    YY: yy,
    BYYYY: byyyy,
    BYY: byy,
    MM: mm,
    SEQ: marker,
  }).split(marker)[0];

  const where = ['request_no LIKE ?'];
  const args = [`${prefix}%`];
  if (settings.reset_period === 'month') {
    where.push(`DATE_FORMAT(created_at, '%Y-%m') = ?`);
    args.push(`${yyyy}-${mm}`);
  } else if (settings.reset_period === 'year') {
    where.push(`YEAR(created_at) = ?`);
    args.push(Number(yyyy));
  }
  const [[{ next }]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(request_no, ?) AS UNSIGNED)), 0) + 1 AS next
       FROM itreq_requests
      WHERE ${where.join(' AND ')}`,
    [prefix.length + 1, ...args],
  );

  return renderRequestNoPattern(settings.pattern, {
    YYYY: yyyy,
    YY: yy,
    BYYYY: byyyy,
    BYY: byy,
    MM: mm,
    SEQ: String(next).padStart(settings.sequence_digits, '0'),
  });
}

function renderRequestNoPattern(pattern, values) {
  return pattern.replace(/\{(YYYY|YY|BYYYY|BYY|MM|SEQ)\}/g, (_, key) => values[key] ?? '');
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}
