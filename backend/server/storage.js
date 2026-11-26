/**
 * จัดการที่เก็บไฟล์ (attachments + Word templates)
 *
 * รองรับ 3 รูปแบบ:
 *   1) IMAGE_STORAGE_PATH=//host/share/path  + credentials → mount Windows SMB
 *   2) IMAGE_STORAGE_PATH ชี้ path ปกติ (โลคัล/path ที่ mount ไว้แล้ว)
 *   3) ไม่ตั้ง → ใช้ ./uploads/ ภายในโปรเจกต์ (default เดิม)
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const RAW_PATH = process.env.IMAGE_STORAGE_PATH || '';
const STORAGE_USER = process.env.IMAGE_STORAGE_USER || '';
const STORAGE_PASS = process.env.IMAGE_STORAGE_PASS || '';

function normalizePath(p) {
  if (!p) return '';
  // Windows UNC: //host/share → \\host\share
  if (process.platform === 'win32' && /^[\\/]{2}/.test(p)) {
    return p.replace(/\//g, '\\');
  }
  return path.resolve(p);
}

const STORAGE_BASE = RAW_PATH ? normalizePath(RAW_PATH) : null;
const FALLBACK = path.resolve(process.cwd(), 'uploads');

// ใช้ subfolder ภายใต้ storage base
export const attachmentsDir = STORAGE_BASE
  ? path.join(STORAGE_BASE, 'attachments')
  : FALLBACK;

export const templatesDir = STORAGE_BASE
  ? path.join(STORAGE_BASE, 'templates')
  : path.join(FALLBACK, 'templates');

export const signaturesDir = STORAGE_BASE
  ? path.join(STORAGE_BASE, 'signatures')
  : path.join(FALLBACK, 'signatures');

function netUse(sharePath) {
  return new Promise((resolve) => {
    const args = [
      'use', sharePath,
      STORAGE_PASS,
      `/user:${STORAGE_USER}`,
      '/persistent:no',
    ];
    const cp = spawn('net', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    cp.stdout.on('data', (b) => { out += b.toString(); });
    cp.stderr.on('data', (b) => { err += b.toString(); });
    cp.on('error', (e) => resolve({ ok: false, message: e.message }));
    cp.on('close', (code) => {
      const text = (out + err).trim();
      // exit code 2 = "ทรัพยากรเครือข่ายถูกใช้งานอยู่แล้ว" (already connected) — นับว่า OK
      if (code === 0 || /already|มีอยู่แล้ว|ใช้งานอยู่แล้ว/i.test(text)) {
        resolve({ ok: true, message: text || 'mounted' });
      } else {
        resolve({ ok: false, message: text || `net use exit ${code}` });
      }
    });
  });
}

/**
 * เรียกตอน server start — mount SMB share (ถ้าจำเป็น) + สร้างโฟลเดอร์ย่อย
 */
export async function initStorage() {
  if (!STORAGE_BASE) {
    await fs.mkdir(attachmentsDir, { recursive: true }).catch(() => {});
    await fs.mkdir(templatesDir, { recursive: true }).catch(() => {});
    console.log(`  storage: local default at ${FALLBACK}`);
    return;
  }

  const isUNC = process.platform === 'win32' && STORAGE_BASE.startsWith('\\\\');
  if (isUNC && STORAGE_USER) {
    // mount เฉพาะส่วน \\host\share ก่อน (subfolder จะเข้าถึงได้ผ่าน path เต็ม)
    const m = STORAGE_BASE.match(/^(\\\\[^\\]+\\[^\\]+)/);
    const sharePath = m ? m[1] : STORAGE_BASE;
    const r = await netUse(sharePath);
    if (r.ok) {
      console.log(`  storage: mounted ${sharePath} OK`);
    } else {
      console.warn(`  storage: net use ${sharePath} failed → ${r.message}`);
      console.warn(`           จะลองใช้ path ตรง ๆ — ถ้าไม่ได้ตรวจ credentials หรือ network`);
    }
  }

  // ตรวจว่าเขียนได้จริง
  try {
    await fs.mkdir(attachmentsDir, { recursive: true });
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(signaturesDir, { recursive: true });
    console.log(`  storage: ready (${STORAGE_BASE})`);
  } catch (err) {
    console.error(`  storage: cannot access ${STORAGE_BASE} → ${err.message}`);
    console.warn(`           fallback ไปใช้ ${FALLBACK} แทน`);
  }
}
