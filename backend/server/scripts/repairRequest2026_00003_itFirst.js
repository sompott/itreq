// REQ-2026-00003 / FM-IT-05: let the IT programmer slot (step 5) sign in the approval
// stage, before step 6 (021033), so signing follows the on-screen order 1 → 6.
import { appDB } from '../db.js';
import { getRequestById, markStepEmailed } from '../repositories/requests.js';
import { getITSigningEmployees } from '../repositories/forms.js';
import { getEmployeeById } from '../repositories/employees.js';
import { createNotification } from '../repositories/notifications.js';
import { notifyApproverStep } from '../mailer.js';
import { config } from '../config.js';

const REQUEST_NO = 'REQ-2026-00003';
const PROGRAMMER_EMP_ID = '021087';
const REPAIR_ACTOR_EMP_ID = '021093';

async function run() {
  const conn = await appDB.getConnection();
  let request;
  try {
    await conn.beginTransaction();
    [[request]] = await conn.query(
      'SELECT id, status, request_type_id FROM itreq_requests WHERE request_no = ? FOR UPDATE', [REQUEST_NO]);
    if (!request || request.status !== 'pending') throw new Error(`unexpected_request:${request?.status}`);

    const [step] = await conn.query(`UPDATE itreq_request_approval_steps
      SET sign_stage = 'approval', email_sent_at = NULL
      WHERE request_id = ? AND step_no = 5 AND signer_mode = 'it_staff' AND status = 'pending'`, [request.id]);
    const [slot] = await conn.query(`UPDATE itreq_approval_slot_templates SET sign_stage = 'approval'
      WHERE request_type_id = ? AND step_no = 5 AND mode = 'it_staff'`, [request.request_type_id]);
    if (step.affectedRows !== 1 || slot.affectedRows !== 1) throw new Error('rows_not_as_expected');

    await conn.query(`INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, from_status, to_status, note)
      VALUES (?, 'repair_signing_structure', ?, 'pending', 'pending', ?)`,
      [request.id, REPAIR_ACTOR_EMP_ID, 'ให้โปรแกรมเมอร์ (IT) เซ็นในช่วงอนุมัติคำขอ ก่อนหัวหน้าหน่วยงาน']);
    await conn.commit();
    console.log('Updated request step 5 and FM-IT-05 slot 5 -> approval stage');
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const full = await getRequestById(request.id);
  const step5 = full.approval_steps.find((s) => s.step_no === 5);
  const recipients = new Map((await getITSigningEmployees()).map((e) => [e.emp_id, e]));
  const programmer = await getEmployeeById(PROGRAMMER_EMP_ID);
  if (programmer) recipients.set(programmer.emp_id, programmer);
  for (const employee of recipients.values()) {
    await createNotification({ recipientEmpId: employee.emp_id, requestId: request.id,
      type: 'approval_required', title: `รอลงนาม: ${full.request_no} (${step5.slot_label})`,
      message: step5.slot_label, linkUrl: `${config.BASE_PATH}/#/approve/${request.id}`,
    }).catch((err) => console.warn('[notification]', err.message));
    await notifyApproverStep(full, { ...step5, approver: employee })
      .catch((err) => console.warn('[email]', err.message));
  }
  await markStepEmailed(step5.id);
  console.log(`Notified: ${[...recipients.keys()].join(', ')}`);
}

run().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
