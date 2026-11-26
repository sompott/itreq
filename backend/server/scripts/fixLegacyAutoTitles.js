import { appDB } from '../db.js';

async function run() {
  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE itreq_requests r
         JOIN itreq_request_types rt ON rt.id = r.request_type_id
          SET r.title = rt.name
        WHERE EXISTS (
          SELECT 1
            FROM itreq_form_definitions fd
            JOIN itreq_form_fields ff ON ff.form_id = fd.id
           WHERE fd.request_type_id = r.request_type_id
             AND fd.is_active = 1
             AND ff.field_name = 'username'
        )
          AND NOT EXISTS (
          SELECT 1
            FROM itreq_form_definitions fd
            JOIN itreq_form_fields ff ON ff.form_id = fd.id
           WHERE fd.request_type_id = r.request_type_id
             AND fd.is_active = 1
             AND (
               ff.field_name IN ('title', 'subject', 'topic', 'heading')
               OR ff.field_label REGEXP 'หัวข้อ|^เรื่อง|ชื่อโปรแกรม|^title$|^subject$|^topic$'
             )
        )`,
    );
    await conn.commit();
    console.log(`Updated ${result.affectedRows} legacy request title(s).`);
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
