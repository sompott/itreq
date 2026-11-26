/**
 * ย้อนสถานะ "ช่องเซ็น" (approval steps) ที่ถูกเซ็น (approved) ในวันนี้ กลับเป็น pending
 * เพื่อให้ผู้อนุมัติเซ็นใหม่อีกครั้ง (ใช้กรณีอัปโหลด/ส่งรายการขึ้นระบบล่าช้า)
 *
 * - จะย้อนเฉพาะ step ที่ status = 'approved' และ signed_at = วันนี้
 * - จะข้าม (ไม่แตะ) request ที่สถานะไปไกลกว่า 'approved' แล้ว
 *   (in_progress / completed / closed / cancelled / rejected) เพื่อความปลอดภัย
 * - ล้างข้อมูลลายเซ็นเดิมของ step ที่ถูกย้อน (signature_type/data/file/comment/signed_at/email_sent_at)
 * - ถ้า request สถานะเป็น 'approved' อยู่ (ครบทุกช่องแล้ว) จะย้อน request กลับเป็น 'pending' ด้วย
 * - บันทึกทุกการเปลี่ยนแปลงลง itreq_request_logs
 *
 * Run (dry-run ก่อนเสมอ — แค่แสดงรายการที่จะถูกย้อน ไม่แก้ข้อมูลจริง):
 *   node --env-file=.env server/scripts/revertTodaySignedSteps.js
 *
 * เมื่อตรวจสอบรายการแล้วโอเค ค่อยรันจริงด้วย --apply:
 *   node --env-file=.env server/scripts/revertTodaySignedSteps.js --apply
 *
 * จำกัดเฉพาะบางคำขอ (comma-separated request_no) ถ้าไม่ต้องการย้อนทั้งหมด:
 *   node --env-file=.env server/scripts/revertTodaySignedSteps.js --apply --request-no=REQ-2026-00123,REQ-2026-00124
 */
import { appDB } from '../db.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const requestNoArg = args.find((a) => a.startsWith('--request-no='));
const requestNoFilter = requestNoArg
  ? requestNoArg.slice('--request-no='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const SAFE_REQUEST_STATUSES = ['pending', 'approved'];

async function main() {
  const where = [
    `s.status = 'approved'`,
    `DATE(s.signed_at) = CURDATE()`,
  ];
  const params = [];
  if (requestNoFilter?.length) {
    where.push(`r.request_no IN (${requestNoFilter.map(() => '?').join(',')})`);
    params.push(...requestNoFilter);
  }

  const [rows] = await appDB.query(
    `SELECT s.id AS step_id, s.request_id, s.step_no, s.slot_label,
            s.approver_emp_id, s.signed_at,
            r.request_no, r.status AS request_status
       FROM itreq_request_approval_steps s
       JOIN itreq_requests r ON r.id = s.request_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.request_no, s.step_no`,
    params,
  );

  if (!rows.length) {
    console.log('ไม่พบช่องเซ็นที่ approved วันนี้ตรงตามเงื่อนไข');
    await appDB.end();
    return;
  }

  const toRevert = rows.filter((r) => SAFE_REQUEST_STATUSES.includes(r.request_status));
  const skipped = rows.filter((r) => !SAFE_REQUEST_STATUSES.includes(r.request_status));

  console.log(`พบช่องเซ็น approved วันนี้ทั้งหมด ${rows.length} ช่อง`);
  console.log(`— จะย้อนสถานะ: ${toRevert.length} ช่อง`);
  for (const r of toRevert) {
    console.log(`   [${r.request_no}] step ${r.step_no} (${r.slot_label}) โดย ${r.approver_emp_id} เซ็นเมื่อ ${r.signed_at} — request status=${r.request_status}`);
  }
  if (skipped.length) {
    console.log(`— ข้าม (request ไปไกลกว่า approved แล้ว): ${skipped.length} ช่อง`);
    for (const r of skipped) {
      console.log(`   [${r.request_no}] step ${r.step_no} (${r.slot_label}) — request status=${r.request_status} (ต้องแก้ด้วยมือถ้าจำเป็น)`);
    }
  }

  if (!apply) {
    console.log('\n(dry-run) ไม่มีการแก้ไขข้อมูลจริง — เพิ่ม --apply เพื่อดำเนินการจริง');
    await appDB.end();
    return;
  }

  const conn = await appDB.getConnection();
  try {
    await conn.beginTransaction();

    for (const r of toRevert) {
      await conn.query(
        `UPDATE itreq_request_approval_steps
            SET status = 'pending',
                signature_type = NULL,
                signature_data = NULL,
                signature_file = NULL,
                comment = NULL,
                signed_at = NULL,
                email_sent_at = NULL
          WHERE id = ?`,
        [r.step_id],
      );
      await conn.query(
        `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, from_status, to_status, note)
         VALUES (?, 'revert_approval', NULL, 'approved', 'pending', ?)`,
        [r.request_id, `ย้อนสถานะช่องเซ็น step ${r.step_no} (${r.slot_label}) เนื่องจากอัปโหลดรายการล่าช้า`],
      );
    }

    const requestIds = [...new Set(toRevert.map((r) => r.request_id))];
    for (const requestId of requestIds) {
      const [[current]] = await conn.query(
        `SELECT status FROM itreq_requests WHERE id = ? LIMIT 1`,
        [requestId],
      );
      if (current?.status === 'approved') {
        await conn.query(`UPDATE itreq_requests SET status = 'pending' WHERE id = ?`, [requestId]);
        await conn.query(
          `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, from_status, to_status, note)
           VALUES (?, 'revert_approval', NULL, 'approved', 'pending', ?)`,
          [requestId, 'ย้อนสถานะคำขอกลับเป็น pending เนื่องจากอัปโหลดรายการล่าช้า'],
        );
      }
    }

    await conn.commit();
    console.log(`\nย้อนสถานะสำเร็จ ${toRevert.length} ช่อง (${requestIds.length} คำขอ)`);
  } catch (err) {
    await conn.rollback();
    console.error('เกิดข้อผิดพลาด ย้อนกลับ (rollback) แล้ว:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await appDB.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
