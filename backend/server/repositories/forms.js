import { appDB } from '../db.js';
import { getEmployeeById } from './employees.js';

export async function getActiveFormByType(requestTypeId) {
  const [forms] = await appDB.query(
    `SELECT id, request_type_id, name, version
     FROM itreq_form_definitions
     WHERE request_type_id = ? AND is_active = 1
     ORDER BY version DESC
     LIMIT 1`,
    [requestTypeId],
  );
  if (!forms.length) return null;

  const form = forms[0];
  const [fields] = await appDB.query(
    `SELECT id, field_label, field_name, field_type, options, placeholder,
            default_value, is_required, sort_order, validation
     FROM itreq_form_fields
     WHERE form_id = ?
     ORDER BY sort_order, id`,
    [form.id],
  );

  form.fields = fields.map((f) => ({
    ...f,
    options: f.options ? safeJson(f.options) : null,
    validation: f.validation ? safeJson(f.validation) : null,
    is_required: !!f.is_required,
  }));
  return form;
}

export async function getApprovalSlotsByType(requestTypeId) {
  const [slots] = await appDB.query(
    `SELECT id, step_no, slot_label, mode, fixed_emp_id, is_required, allow_skip, sign_stage
     FROM itreq_approval_slot_templates
     WHERE request_type_id = ?
     ORDER BY step_no`,
    [requestTypeId],
  );

  const out = [];
  for (const slot of slots) {
    out.push({
      ...slot,
      is_required: !!slot.is_required,
      allow_skip: !!slot.allow_skip,
      fixed_employee: slot.fixed_emp_id ? await getEmployeeById(slot.fixed_emp_id) : null,
    });
  }
  return out;
}

export async function getITSigningEmployees() {
  const [rows] = await appDB.query("SELECT DISTINCT emp_id FROM itreq_user_roles WHERE is_active = 1 AND role IN ('it_staff','admin')");
  return (await Promise.all(rows.map((row) => getEmployeeById(row.emp_id)))).filter(Boolean);
}

function safeJson(value) {
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
