/**
 * Save/load ลายเซ็น (PNG) ไปยัง NAS
 * ใช้แทน base64 ใน signature_data column
 */
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { inflateSync } from 'zlib';
import { signaturesDir } from '../storage.js';

async function ensureDir() {
  await fs.mkdir(signaturesDir, { recursive: true });
}

/**
 * บันทึก dataURL → ไฟล์ PNG บน NAS, คืน "ชื่อไฟล์" สำหรับเก็บใน DB
 *
 * @param {string} dataUrl  data:image/png;base64,xxx... — ถ้าไม่ใช่ dataURL คืน null
 * @param {string} [prefix] เช่น `req${requestId}_step${stepNo}` (ทำให้ debug ง่าย)
 * @returns {Promise<string|null>} ชื่อไฟล์ (เช่น `req14_step2_<uuid>.png`)
 */
export async function saveSignatureDataUrl(dataUrl, prefix = 'sig') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:')) return null;
  await ensureDir();
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1] || 'image/png';
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? '.jpg'
    : mime.includes('gif') ? '.gif'
    : '.png';
  const buf = Buffer.from(match[2], 'base64');
  const filename = `${prefix}_${randomUUID()}${ext}`;
  await fs.writeFile(path.join(signaturesDir, filename), buf);
  return filename;
}

/**
 * ตรวจว่า PNG จาก canvas มีพิกเซลที่มองเห็นได้จริงหรือไม่
 * canvas เปล่าจะเป็นภาพโปร่งใสทั้งหมด แม้จะมี data URL ที่ดูเหมือนภาพปกติ
 */
export function hasVisibleInkDataUrl(dataUrl) {
  try {
    const match = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return false;
    const png = Buffer.from(match[1], 'base64');
    if (png.length < 33 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return false;

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = -1;
    let interlace = -1;
    const idat = [];
    while (offset + 12 <= png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.toString('ascii', offset + 4, offset + 8);
      const start = offset + 8;
      const end = start + length;
      if (end + 4 > png.length) return false;
      if (type === 'IHDR') {
        width = png.readUInt32BE(start);
        height = png.readUInt32BE(start + 4);
        bitDepth = png[start + 8];
        colorType = png[start + 9];
        interlace = png[start + 12];
      } else if (type === 'IDAT') {
        idat.push(png.subarray(start, end));
      } else if (type === 'IEND') {
        break;
      }
      offset = end + 4;
    }

    const bytesPerPixel = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
    if (!width || !height || width * height > 8_000_000 || bitDepth !== 8
      || interlace !== 0 || !bytesPerPixel || idat.length === 0) return false;

    const stride = width * bytesPerPixel;
    const inflated = inflateSync(Buffer.concat(idat));
    if (inflated.length !== (stride + 1) * height) return false;
    let inputOffset = 0;
    let previous = Buffer.alloc(stride);

    for (let y = 0; y < height; y += 1) {
      const filter = inflated[inputOffset++];
      const row = Buffer.allocUnsafe(stride);
      for (let x = 0; x < stride; x += 1) {
        const raw = inflated[inputOffset++];
        const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
        const up = previous[x];
        const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
        let value;
        if (filter === 0) value = raw;
        else if (filter === 1) value = raw + left;
        else if (filter === 2) value = raw + up;
        else if (filter === 3) value = raw + Math.floor((left + up) / 2);
        else if (filter === 4) value = raw + paeth(left, up, upperLeft);
        else return false;
        row[x] = value & 0xff;
      }

      if (colorType === 6) {
        for (let x = 3; x < stride; x += 4) if (row[x] > 8) return true;
      } else if (colorType === 4) {
        for (let x = 1; x < stride; x += 2) if (row[x] > 8) return true;
      } else {
        // Canvas output normally contains alpha (type 6). For an opaque PNG,
        // require at least one non-white pixel so a blank white image is rejected.
        for (let x = 0; x < stride; x += bytesPerPixel) {
          if (row[x] < 245 || (bytesPerPixel === 3 && (row[x + 1] < 245 || row[x + 2] < 245))) return true;
        }
      }
      previous = row;
    }
    return false;
  } catch {
    return false;
  }
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

/** ลบไฟล์ลายเซ็น (เงียบๆ ถ้าไม่มีก็ไม่ throw) */
export async function deleteSignatureFile(filename) {
  if (!filename) return;
  try {
    await fs.unlink(path.join(signaturesDir, filename));
  } catch {}
}

/** path เต็มของไฟล์ลายเซ็น (ใช้ใน res.sendFile) */
export function signatureFilePath(filename) {
  if (!filename) return null;
  return path.join(signaturesDir, filename);
}
