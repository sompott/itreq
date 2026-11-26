import { decryptMachineKeyToken, extractTokenFromCookie } from './utils/machineKey.js';
import { authConfig, ssoEnabled } from './config.js';
import { appDB } from './db.js';
import { getEmployeeById, getPsweb2Permission } from './repositories/employees.js';

/**
 * แปลง Cookie จาก request → empCode ของผู้ใช้
 * คืน null ถ้าถอดรหัสไม่ได้/ไม่มี token/ไม่ได้เปิด SSO
 */
export function resolveEmpCodeFromCookie(req) {
  if (!ssoEnabled) return null;
  const token = extractTokenFromCookie(req.headers.cookie || '');
  if (!token) return null;

  const decrypted = decryptMachineKeyToken(token, authConfig.decryptionKey);
  if (!decrypted) return null;

  // Format: Username|DisplayName|UCode|UID|UserType
  const parts = decrypted.split('|');
  if (parts.length < 5) return null;
  return parts[2] || null;
}

/**
 * ตรวจ role ของผู้ใช้ในระบบ IT Request — ลำดับการตัดสิทธิ์:
 *   1) psweb2 U_Type = '1'    → admin (super admin ของระบบ psweb2)
 *   2) psweb2 uapp_full = 1   → admin (admin ของแอป IT Request)
 *   3) itreq_user_roles       → ใช้ role ที่ตั้งใน DB ของแอป
 *   4) psweb2 uapp_read = 1   → it_staff
 *   5) default                → requester
 */
export async function resolveRole(empCode) {
  if (!empCode) return null;

  let psweb2Perm = null;
  try {
    psweb2Perm = await getPsweb2Permission(empCode, authConfig.appId || null);
  } catch (err) {
    console.warn('[auth] psweb2 perm lookup failed:', err.message);
  }

  // (1) (2) — psweb2 system / app admin
  if (psweb2Perm?.u_type === '1') return 'admin';
  if (psweb2Perm?.uapp_full) return 'admin';

  // (3) — role ที่ admin ของระบบนี้กำหนดให้
  const [appRoles] = await appDB.query(
    `SELECT role FROM itreq_user_roles WHERE emp_id = ? AND is_active = 1`,
    [empCode],
  );
  if (appRoles.length) {
    const order = ['admin', 'it_staff', 'approver', 'requester'];
    appRoles.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
    return appRoles[0].role;
  }

  // (4) — read-only ของแอป → it_staff
  if (psweb2Perm?.uapp_read) return 'it_staff';

  // (5)
  return 'requester';
}

/**
 * รวมข้อมูล user สำหรับส่งกลับ frontend
 */
export async function buildAuthUser(empCode) {
  const employee = await getEmployeeById(empCode);
  if (!employee) return null;
  const role = await resolveRole(empCode);
  return { ...employee, role };
}

/**
 * Express middleware — แนบ req.user ถ้า cookie valid (ไม่บังคับ)
 */
export async function attachUser(req, _res, next) {
  try {
    const empCode = resolveEmpCodeFromCookie(req);
    if (empCode) {
      req.user = await buildAuthUser(empCode);
    }
  } catch (err) {
    console.warn('[auth] attachUser error:', err.message);
  }
  next();
}

/**
 * Express middleware — บังคับว่าต้อง login
 */
export function requireAuth(req, res, next) {
  if (req.user?.emp_id) return next();
  res.status(401).json({ error: 'unauthorized', login_url: authConfig.iisLoginUrl });
}
