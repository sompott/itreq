import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { appDB } from '../db.js';
import { templatesDir as TEMPLATE_DIR } from '../storage.js';

async function ensureDir() {
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
}

export async function saveTemplate({ requestTypeId, originalName, dataBase64 }) {
  if (!requestTypeId || !originalName || !dataBase64) {
    throw Object.assign(new Error('missing_template_fields'), { httpStatus: 400 });
  }
  await ensureDir();

  const cleanBase64 = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(cleanBase64, 'base64');
  const ext = (path.extname(originalName) || '.docx').slice(0, 10);
  const storedName = `type_${requestTypeId}_${randomUUID()}${ext}`;
  const fullPath = path.join(TEMPLATE_DIR, storedName);
  await fs.writeFile(fullPath, buf);

  // ลบไฟล์เดิม (ถ้ามี)
  const [[old]] = await appDB.query(
    `SELECT template_file FROM itreq_request_types WHERE id = ? LIMIT 1`,
    [requestTypeId],
  );
  if (old?.template_file) {
    try { await fs.unlink(path.join(TEMPLATE_DIR, old.template_file)); } catch {}
  }

  await appDB.query(
    `UPDATE itreq_request_types SET template_file = ? WHERE id = ?`,
    [storedName, requestTypeId],
  );

  return { stored_name: storedName, original_name: originalName, size: buf.length };
}

export async function getTemplatePath(requestTypeId) {
  const [[row]] = await appDB.query(
    `SELECT template_file FROM itreq_request_types WHERE id = ? LIMIT 1`,
    [requestTypeId],
  );
  if (!row?.template_file) return null;
  return path.join(TEMPLATE_DIR, row.template_file);
}

export async function removeTemplate(requestTypeId) {
  const [[row]] = await appDB.query(
    `SELECT template_file FROM itreq_request_types WHERE id = ? LIMIT 1`,
    [requestTypeId],
  );
  if (row?.template_file) {
    try { await fs.unlink(path.join(TEMPLATE_DIR, row.template_file)); } catch {}
  }
  await appDB.query(`UPDATE itreq_request_types SET template_file = NULL WHERE id = ?`, [requestTypeId]);
}
