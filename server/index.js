import express from 'express';
import { config, getEmpPicture } from './config.js';
import {
  approvalTemplates,
  currentUser,
  employeeById,
  employees,
  formDefinitions,
  requestTypes,
  requests,
} from './mockData.js';

const app = express();
app.use(express.json({ limit: '8mb' }));

const api = express.Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, app: config.APP_NAME, mock: config.USE_MOCKS });
});

api.get('/me', (_req, res) => {
  res.json({ user: currentUser });
});

api.get('/employees', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const result = employees
    .filter((employee) => !q || `${employee.emp_id} ${employee.name} ${employee.department}`.toLowerCase().includes(q))
    .map((employee) => ({ ...employee, picture_url: getEmpPicture(employee.emp_id) }));
  res.json({ employees: result });
});

api.get('/request-types', (_req, res) => {
  res.json({ request_types: requestTypes.filter((type) => type.is_active) });
});

api.get('/request-types/:id/form', (req, res) => {
  const id = Number(req.params.id);
  const form = formDefinitions[id];
  if (!form) return res.status(404).json({ error: 'form_not_found' });
  const approval_slots = approvalTemplates[id].map((slot) => ({
    ...slot,
    fixed_employee: slot.fixed_emp_id ? employeeById(slot.fixed_emp_id) : null,
  }));
  res.json({ form, approval_slots });
});

api.post('/requests/draft', (req, res) => {
  const draft = createRequest(req.body, 'draft');
  requests.push(draft);
  res.status(201).json({ request: draft });
});

api.post('/requests', (req, res) => {
  const request = createRequest(req.body, 'pending_approval');
  requests.push(request);
  res.status(201).json({
    request,
    mock_email: {
      status: 'queued_mock',
      message: 'Production SMTP is not configured. Approver emails are mocked.',
      recipients: request.approval_steps.filter((step) => step.status !== 'skipped').map((step) => step.approver?.email),
    },
  });
});

api.get('/requests', (_req, res) => {
  res.json({ requests });
});

api.get('/requests/:id/template-data', (req, res) => {
  const request = requests.find((item) => item.id === Number(req.params.id)) || buildDemoTemplateRequest();
  const variables = {
    request_no: request.request_no,
    requester_name: request.requester.name,
    requester_department: request.requester.department,
    created_date: formatThaiDate(request.created_at),
    request_type: request.request_type.name,
    title: request.values.title || '',
    detail: request.values.detail || '',
    ...request.values,
  };

  request.approval_steps.forEach((step) => {
    variables[`approver_${step.step_no}_name`] = step.approver?.name || '';
    variables[`approver_${step.step_no}_signature`] = step.signature_data || (step.approver ? getEmpPicture(step.approver.emp_id) : '');
    variables[`approver_${step.step_no}_signed_at`] = step.signed_at || '';
  });

  res.json({
    variables,
    available_placeholders: Object.keys(variables).map((key) =>
      key.includes('signature') ? `{%${key}}` : `{{${key}}}`,
    ),
  });
});

app.use(config.API_PREFIX, api);
app.use('/api', api);

app.listen(config.PORT, () => {
  console.log(`IT request API listening on http://127.0.0.1:${config.PORT}${config.API_PREFIX}`);
});

function createRequest(body, status) {
  const now = new Date();
  const requestType = requestTypes.find((type) => type.id === Number(body.request_type_id)) || requestTypes[0];
  const selected = body.selected_approvers || {};
  const slots = approvalTemplates[requestType.id] || [];
  const approval_steps = slots.map((slot) => {
    const empId = slot.mode === 'fixed' ? slot.fixed_emp_id : selected[slot.id];
    const approver = empId ? employeeById(empId) : null;
    return {
      step_no: slot.step_no,
      slot_label: slot.slot_label,
      approver,
      status: approver ? 'pending' : 'skipped',
      signature_type: null,
      signature_data: null,
      comment: '',
      signed_at: null,
      email_sent_at: status === 'pending_approval' && approver ? now.toISOString() : null,
    };
  });

  return {
    id: requests.length + 1,
    request_no: `REQ-${now.getFullYear()}-${String(requests.length + 1).padStart(5, '0')}`,
    requester: currentUser,
    request_type: requestType,
    values: body.values || {},
    urgency: body.urgency || 'normal',
    status,
    requester_signature: body.requester_signature || null,
    approval_steps,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function buildDemoTemplateRequest() {
  return createRequest({
    request_type_id: 1,
    values: {
      title: 'ขอติดตั้งโปรแกรม Photoshop',
      detail: 'ใช้สำหรับงานออกแบบสื่อประชาสัมพันธ์ภายในบริษัท',
      phone: '1234',
      required_date: '2026-06-10',
      software_name: 'Adobe Photoshop 2024',
    },
    selected_approvers: { 2: '010882', 4: '010882' },
  }, 'pending_approval');
}

function formatThaiDate(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}
