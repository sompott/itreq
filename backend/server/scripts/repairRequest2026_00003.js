// REQ-2026-00003: the request was created when slot 5 (IT programmer) and slot 6 (021033)
// were "completion" stage, so IT could start work before they signed. Re-align the
// request with the current form design (slot 5 = acceptance, slot 6 = approval) and
// send it back to pending so everyone signs before work starts.
import { appDB } from '../db.js';
import { getRequestById, markStepEmailed } from '../repositories/requests.js';
import { createNotification } from '../repositories/notifications.js';
import { notifyApproverStep } from '../mailer.js';
import { config } from '../config.js';

const REQUEST_NO = 'REQ-2026-00003';
const REPAIR_ACTOR_EMP_ID = '021093';

async function run() {
  const conn = await appDB.getConnection();
  let requestId;
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      'SELECT id, status FROM itreq_requests WHERE request_no = ? FOR UPDATE', [REQUEST_NO]);
    if (!request) throw new Error('request_not_found');
    if (request.status !== 'in_progress') throw new Error(`unexpected_status:${request.status}`);
    requestId = request.id;

    const [s5] = await conn.query(`UPDATE itreq_request_approval_steps
      SET sign_stage = 'acceptance', email_sent_at = NULL
      WHERE request_id = ? AND step_no = 5 AND signer_mode = 'it_staff' AND status = 'pending'`, [request.id]);
    const [s6] = await conn.query(`UPDATE itreq_request_approval_steps
      SET sign_stage = 'approval', email_sent_at = NULL
      WHERE request_id = ? AND step_no = 6 AND approver_emp_id = '021033' AND status = 'pending'`, [request.id]);
    if (s5.affectedRows !== 1 || s6.affectedRows !== 1) throw new Error('steps_not_as_expected');

    await conn.query("UPDATE itreq_requests SET status = 'pending' WHERE id = ?", [request.id]);
    await conn.query(`INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, from_status, to_status, note)
      VALUES (?, 'repair_signing_structure', ?, 'in_progress', 'pending', ?)`,
      [request.id, REPAIR_ACTOR_EMP_ID, 'ปรับโครงสร้างให้ทุกคนเซ็นครบก่อนเริ่มงาน (ตามฟอร์มปัจจุบัน)']);
    await conn.commit();
    console.log(`Repaired ${REQUEST_NO} -> pending`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  // Notify the next approver (021033), same as dispatchNextApprover in index.js.
  const request = await getRequestById(requestId);
  const step = request.approval_steps.find((s) => s.step_no === 6);
  await createNotification({
    recipientEmpId: step.approver_emp_id, requestId, type: 'approval_required',
    title: `รออนุมัติ: ${request.request_no} (ขั้นที่ ${step.step_no})`,
    message: `${request.requester?.name || ''} ส่งคำขอ "${request.title}" ให้ท่านอนุมัติ`,
    linkUrl: `${config.BASE_PATH}/#/approve/${requestId}`,
  });
  await notifyApproverStep(request, step).then(() => markStepEmailed(step.id))
    .catch((err) => console.warn('[email]', err.message));
  console.log(`Notified ${step.approver_emp_id}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => appDB.end());
