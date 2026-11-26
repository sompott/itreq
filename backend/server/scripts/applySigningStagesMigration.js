import { appDB } from '../db.js';

try {
  for (const table of ['itreq_approval_slot_templates', 'itreq_request_approval_steps']) {
    const [columns] = await appDB.query(`SHOW COLUMNS FROM ${table}`);
    if (!columns.some((column) => column.Field === 'sign_stage')) {
      await appDB.query(`ALTER TABLE ${table} ADD sign_stage ENUM('approval','acceptance','completion') NOT NULL DEFAULT 'approval'`);
    }
  }
  await appDB.query("ALTER TABLE itreq_approval_slot_templates MODIFY mode ENUM('fixed','selectable','self','it_staff') NOT NULL DEFAULT 'selectable'");
  const [columns] = await appDB.query('SHOW COLUMNS FROM itreq_request_approval_steps');
  if (!columns.some((column) => column.Field === 'signer_mode')) {
    await appDB.query("ALTER TABLE itreq_request_approval_steps ADD signer_mode ENUM('fixed','selectable','self','it_staff') NOT NULL DEFAULT 'fixed'");
  }
  await appDB.query('ALTER TABLE itreq_request_approval_steps MODIFY approver_emp_id VARCHAR(20) DEFAULT NULL');
  // Bring the previous per-type settings into the same slot editor without changing existing slot numbers.
  const [types] = await appDB.query('SELECT id, it_acceptance_required, it_completion_required FROM itreq_request_types');
  for (const type of types) {
    for (const [stage, label] of [['acceptance', 'IT ลงนามรับงาน'], ['completion', 'IT ลงนามยืนยันงานเสร็จ']]) {
      if (!type[`it_${stage}_required`]) continue;
      const [[existing]] = await appDB.query('SELECT id FROM itreq_approval_slot_templates WHERE request_type_id = ? AND sign_stage = ?', [type.id, stage]);
      if (existing) continue;
      const [[{ next_step }]] = await appDB.query('SELECT COALESCE(MAX(step_no), 0) + 1 AS next_step FROM itreq_approval_slot_templates WHERE request_type_id = ?', [type.id]);
      await appDB.query(`INSERT INTO itreq_approval_slot_templates
        (request_type_id, step_no, slot_label, mode, sign_stage, is_required, allow_skip)
        VALUES (?, ?, ?, 'it_staff', ?, 1, 0)`, [type.id, next_step, label, stage]);
    }
  }
  console.log('Signing stages ready');
} finally { await appDB.end(); }
