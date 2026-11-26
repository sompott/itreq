import { appDB } from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { attachmentsDir as UPLOAD_DIR } from '../storage.js';

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveAttachment({ requestId, fieldId, kind, fileName, mimeType, dataBase64, uploadedBy }) {
  if (!requestId || !fileName || !dataBase64) {
    throw Object.assign(new Error('missing_attachment_fields'), { httpStatus: 400 });
  }
  const safeKind = kind === 'completion' ? 'completion' : 'request';
  await ensureDir();

  const cleanBase64 = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(cleanBase64, 'base64');
  const ext = (path.extname(fileName) || '').slice(0, 10);
  const storedName = `${requestId}_${randomUUID()}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, storedName);
  await fs.writeFile(fullPath, buf);

  const [result] = await appDB.query(
    `INSERT INTO itreq_attachments
       (request_id, field_id, kind, file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [requestId, fieldId || null, safeKind, fileName, storedName, buf.length, mimeType || null, uploadedBy || null],
  );

  return {
    id: result.insertId,
    file_name: fileName, file_path: storedName,
    file_size: buf.length, mime_type: mimeType, kind: safeKind,
  };
}

export async function listForRequest(requestId) {
  const [rows] = await appDB.query(
    `SELECT id, request_id, field_id, kind, file_name, file_path, file_size, mime_type, uploaded_by, uploaded_at
       FROM itreq_attachments WHERE request_id = ? ORDER BY uploaded_at`,
    [requestId],
  );
  return rows;
}

export async function getAttachmentFilePath(id) {
  const [rows] = await appDB.query(
    `SELECT file_name, file_path, mime_type FROM itreq_attachments WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!rows.length) return null;
  return {
    file_name: rows[0].file_name,
    mime_type: rows[0].mime_type,
    full_path: path.join(UPLOAD_DIR, rows[0].file_path),
  };
}

export async function listImageFilesForRequest(requestId) {
  const [rows] = await appDB.query(
    `SELECT id, file_name, file_path, mime_type
       FROM itreq_attachments
      WHERE request_id = ?
        AND (mime_type LIKE 'image/%'
             OR LOWER(file_name) REGEXP '\\.(png|jpe?g|gif|webp)$')
      ORDER BY uploaded_at, id`,
    [requestId],
  );
  return rows.map((row) => ({
    ...row,
    full_path: path.join(UPLOAD_DIR, row.file_path),
  }));
}
