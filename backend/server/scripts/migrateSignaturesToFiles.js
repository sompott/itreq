/**
 * One-off migration: extract base64 signatures from DB → write to NAS as files
 *   - อ่าน approval_steps ที่ยังมี signature_data เป็น dataURL
 *   - เขียนเป็นไฟล์บน NAS
 *   - update signature_file = filename, signature_data = NULL
 *
 * Run:
 *   node --env-file=.env server/scripts/migrateSignaturesToFiles.js
 */
import { appDB } from '../db.js';
import { initStorage } from '../storage.js';
import { saveSignatureDataUrl } from '../repositories/signatures.js';

async function main() {
  await initStorage();

  const [rows] = await appDB.query(
    `SELECT id, request_id, step_no, signature_data
       FROM itreq_request_approval_steps
      WHERE signature_data IS NOT NULL
        AND signature_data LIKE 'data:%'
        AND signature_file IS NULL`,
  );

  console.log(`พบ ${rows.length} ลายเซ็นที่เป็น base64 ใน DB`);
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const filename = await saveSignatureDataUrl(
        r.signature_data,
        `req${r.request_id}_step${r.step_no}`,
      );
      if (!filename) { fail++; continue; }
      await appDB.query(
        `UPDATE itreq_request_approval_steps
            SET signature_file = ?, signature_data = NULL
          WHERE id = ?`,
        [filename, r.id],
      );
      console.log(`  ✓ step id=${r.id} → ${filename}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ step id=${r.id} → ${err.message}`);
      fail++;
    }
  }
  console.log(`เสร็จสิ้น: สำเร็จ ${ok} · ล้มเหลว ${fail}`);
  await appDB.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
