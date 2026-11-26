import { appDB } from '../db.js';
import { getEmpSignature } from '../config.js';

const REQUEST_NO = '08-003-69';
const REQUESTER_EMP_ID = '041212';
const REPAIR_ACTOR_EMP_ID = '021093';
const ORIGINAL_SIGNED_AT = '2026-08-01 16:55:05';

async function run() {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      'SELECT id, status FROM itreq_requests WHERE request_no = ? FOR UPDATE',
      [REQUEST_NO],
    );
    if (!request) throw new Error('request_not_found');
    await conn.query(
      `UPDATE itreq_requests SET status = 'pending' WHERE id = ?`,
      [request.id],
    );
    const [stepResult] = await conn.query(
      `UPDATE itreq_request_approval_steps
          SET status = 'approved', signature_type = 'fetch', signature_data = ?,
              signature_file = NULL, comment = NULL, signed_at = ?, email_sent_at = NULL
        WHERE request_id = ? AND step_no = 1 AND approver_emp_id = ?`,
      [getEmpSignature(REQUESTER_EMP_ID), ORIGINAL_SIGNED_AT, request.id, REQUESTER_EMP_ID],
    );
    if (stepResult.affectedRows !== 1) throw new Error('requester_approval_step_not_found');
    await conn.query(
      `INSERT INTO itreq_request_logs
         (request_id, action, actor_emp_id, from_status, to_status, note)
       VALUES (?, 'repair_admin_edit_workflow', ?, ?, 'pending', ?)`,
      [request.id, REPAIR_ACTOR_EMP_ID, request.status, 'restore workflow after admin edit incorrectly returned request'],
    );
    await conn.commit();
    console.log(`Repaired ${REQUEST_NO}.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await appDB.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
