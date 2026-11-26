import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.APP_DB_HOST || '127.0.0.1',
  port: Number(process.env.APP_DB_PORT || 3306),
  user: process.env.APP_DB_USER || 'root',
  password: process.env.APP_DB_PASSWORD || '',
  database: process.env.APP_DB_NAME || 'dbps_itreq',
});

try {
  await conn.query(
    "ALTER TABLE itreq_approval_slot_templates MODIFY mode ENUM('fixed','selectable','self') NOT NULL DEFAULT 'selectable'",
  );
  const [rows] = await conn.query("SHOW COLUMNS FROM itreq_approval_slot_templates LIKE 'mode'");
  console.log(rows[0]?.Type || 'mode column not found');
} finally {
  await conn.end();
}
