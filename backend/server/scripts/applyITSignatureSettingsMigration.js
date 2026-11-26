import { appDB } from '../db.js';

try {
  const [columns] = await appDB.query('SHOW COLUMNS FROM itreq_request_types');
  if (!columns.some((column) => column.Field === 'it_acceptance_required')) {
    await appDB.query('ALTER TABLE itreq_request_types ADD it_acceptance_required TINYINT(1) NOT NULL DEFAULT 0');
    await appDB.query("UPDATE itreq_request_types SET it_acceptance_required = 1 WHERE name LIKE '%ยืม%'");
  }
  if (!columns.some((column) => column.Field === 'it_completion_required')) {
    await appDB.query('ALTER TABLE itreq_request_types ADD it_completion_required TINYINT(1) NOT NULL DEFAULT 1');
  }
  console.log('IT signature settings ready');
} finally {
  await appDB.end();
}
