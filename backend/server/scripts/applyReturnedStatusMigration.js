import { appDB } from '../db.js';

async function run() {
  await appDB.query(
    `ALTER TABLE itreq_requests
       MODIFY COLUMN status
       ENUM('draft','pending','returned','approved','rejected','in_progress','completed','closed','cancelled')
       NOT NULL DEFAULT 'draft'`,
  );
  console.log('Returned request status migration applied.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => appDB.end());
