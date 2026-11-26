import { appDB } from '../db.js';

export async function listActiveRequestTypes() {
  const [rows] = await appDB.query(
    `SELECT id, name, description, is_active, sort_order
     FROM itreq_request_types
     WHERE is_active = 1
     ORDER BY sort_order, id`,
  );
  return rows;
}

export async function getRequestTypeById(id) {
  const [rows] = await appDB.query(
    `SELECT id, name, description, is_active, it_acceptance_required, it_completion_required
       FROM itreq_request_types WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}
