import { empDB } from '../db.js';
import { getEmpPicture, getEmpSignature } from '../config.js';

const EMP_SELECT = `
  emp_code   AS emp_id,
  TRIM(CONCAT_WS(' ', NULLIF(emp_profix,''), emp_name, emp_lastname)) AS name,
  emp_name      AS first_name,
  emp_lastname  AS last_name,
  emp_nickname  AS nickname,
  emp_department AS department,
  emp_dept_id   AS dept_id,
  emp_section   AS section,
  emp_position  AS position,
  emp_email     AS email,
  emp_tel       AS phone,
  emp_pic       AS picture_field,
  emp_sign      AS signature_field,
  emp_status    AS status
`;

function ensureEmpDB() {
  if (!empDB) {
    throw Object.assign(new Error('emp_db_not_configured'), { httpStatus: 503 });
  }
}

// ลายเซ็นยึดไฟล์ที่ SIGN_IMAGE_BASE_URL/{emp_code}.PNG เป็นหลัก (ไม่ดู emp_sign)
// ตรวจว่ามีไฟล์จริงด้วย HEAD request แล้ว cache ผลไว้ ลดการยิงซ้ำ
const SIGN_CHECK_TTL_FOUND = 30 * 60 * 1000;
const SIGN_CHECK_TTL_MISSING = 5 * 60 * 1000;
const SIGN_CHECK_TIMEOUT = 5000;
const signatureCache = new Map(); // emp_code -> { exists, expires }

async function signatureExists(empCode) {
  const cached = signatureCache.get(empCode);
  if (cached && cached.expires > Date.now()) return cached.exists;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIGN_CHECK_TIMEOUT);
  try {
    const res = await fetch(getEmpSignature(empCode), { method: 'HEAD', signal: controller.signal });
    const type = res.headers.get('content-type') || '';
    const exists = res.ok && type.startsWith('image/');
    signatureCache.set(empCode, {
      exists,
      expires: Date.now() + (exists ? SIGN_CHECK_TTL_FOUND : SIGN_CHECK_TTL_MISSING),
    });
    return exists;
  } catch (err) {
    // เช็คไม่ได้ (network/timeout) — ใช้ผลเดิมถ้ามี ไม่งั้นถือว่าไม่มี และไม่ cache
    console.warn(`[employees] signature check failed for ${empCode}:`, err.message);
    return cached ? cached.exists : false;
  } finally {
    clearTimeout(timer);
  }
}

function decorate(row) {
  if (!row) return null;
  return {
    ...row,
    picture_url: toAbsolute(row.picture_field, getEmpPicture(row.emp_id)),
    signature_url: getEmpSignature(row.emp_id),
    is_active: Number(row.status) === 1,
  };
}

async function decorateWithSignature(row) {
  const emp = decorate(row);
  if (!emp) return null;
  const hasSignature = await signatureExists(emp.emp_id);
  return {
    ...emp,
    signature_url: hasSignature ? emp.signature_url : null,
    has_signature: hasSignature,
  };
}

function toAbsolute(value, defaultUrl) {
  if (!value) return defaultUrl;
  const s = String(value).trim();
  if (!s) return defaultUrl;
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
  // ค่าเป็นชื่อไฟล์ (เช่น "021093.jpg") — ใช้ default URL pattern แทน
  return defaultUrl;
}

export async function searchEmployees(keyword = '') {
  ensureEmpDB();
  const q = String(keyword || '').trim();
  const like = `%${q}%`;
  const [rows] = await empDB.query(
    `SELECT ${EMP_SELECT}
       FROM psweb2_employee
      WHERE emp_status = 1
        AND (? = '' OR emp_code LIKE ? OR emp_name LIKE ? OR emp_lastname LIKE ?
             OR emp_nickname LIKE ? OR emp_department LIKE ?)
      ORDER BY emp_name, emp_lastname
      LIMIT 200`,
    [q, like, like, like, like, like],
  );
  return rows.map(decorate);
}

export async function getEmployeeById(empCode) {
  if (!empCode) return null;
  ensureEmpDB();
  const [rows] = await empDB.query(
    `SELECT ${EMP_SELECT} FROM psweb2_employee WHERE emp_code = ? LIMIT 1`,
    [empCode],
  );
  return decorateWithSignature(rows[0]);
}

/**
 * สิทธิ์ผู้ใช้ใน psweb2 — รวมทั้ง U_Type (ระดับบัญชี) และ uapp permission (ระดับแอป)
 *   U_Type = '1'   → super admin (เข้าได้ทุกแอป)
 *   uapp_full = 1  → admin ของแอปนี้
 *   uapp_read = 1  → ดูได้อย่างเดียว (ใช้ map เป็น it_staff)
 *
 * appId เป็น optional — ถ้าไม่ส่งจะดึงแค่ U_Type
 */
export async function getPsweb2Permission(empCode, appId) {
  if (!empDB || !empCode) return null;
  const useApp = !!appId;
  const sql = useApp
    ? `SELECT u.U_Type,
              CAST(a.uapp_full AS UNSIGNED) AS uapp_full,
              CAST(a.uapp_read AS UNSIGNED) AS uapp_read
         FROM psweb2_user u
         LEFT JOIN psweb2_uapp a ON u.U_ID = a.U_ID AND a.App_ID = ?
        WHERE u.U_PSID = ? LIMIT 1`
    : `SELECT u.U_Type FROM psweb2_user u WHERE u.U_PSID = ? LIMIT 1`;
  const args = useApp ? [appId, empCode] : [empCode];
  const [rows] = await empDB.query(sql, args);
  if (!rows.length) return null;
  const p = rows[0];
  const isTrue = (val) => {
    if (val == null) return false;
    if (Buffer.isBuffer(val)) return val[0] === 1 || val[0] === 49;
    return val === 1 || val === '1';
  };
  return {
    u_type: p.U_Type != null ? String(p.U_Type) : null,
    uapp_full: isTrue(p.uapp_full),
    uapp_read: isTrue(p.uapp_read),
  };
}
