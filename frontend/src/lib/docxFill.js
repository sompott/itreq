/**
 * โหลด pizzip + docxtemplater + image-module จาก CDN
 * แล้ว fill placeholder ใน .docx ของผู้ใช้
 *
 * Pattern ใน .docx:
 *   {{ตัวแปร}}       — แทนที่ด้วยข้อความ
 *   {%ตัวแปร}        — แทรกรูป (เช่น ลายเซ็น)
 */

const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.1.7/dist/pizzip.js';
const CDN_DOCXTEMPLATER = 'https://unpkg.com/docxtemplater@3.50.0/build/docxtemplater.js';
const CDN_IMAGE_MODULE = 'https://unpkg.com/docxtemplater-image-module-free@1.1.1/build/imagemodule.js';

let loadingPromise = null;
async function loadLibs() {
  if (window.PizZip && window.docxtemplater) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await addScript(CDN_PIZZIP);
    await addScript(CDN_DOCXTEMPLATER);
    try {
      await addScript(CDN_IMAGE_MODULE);
    } catch (err) {
      console.warn('[docxFill] image module failed to load — รูปลายเซ็นจะไม่ขึ้น:', err.message);
    }
    if (!window.ImageModule) {
      console.warn('[docxFill] window.ImageModule undefined — รูปจะใส่ไม่ได้');
    }
  })();
  return loadingPromise;
}

function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr.buffer;
}

async function fetchImageBuffer(url, timeoutMs = 4000) {
  if (!url) return null;
  // base64 dataURL
  if (url.startsWith('data:')) {
    const base64 = url.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return arr.buffer;
  }
  // URL — มี timeout กันค้างถ้า host ไม่ตอบ
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// cache รูปข้าม render เผื่อกดดาวน์โหลดซ้ำ
const imageCache = new Map();

async function getCachedImage(url, timeoutMs) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = fetchImageBuffer(url, timeoutMs);
  imageCache.set(url, promise);
  const buf = await promise;
  // ถ้าโหลดไม่สำเร็จ — ลบออกจาก cache จะได้ลองใหม่ครั้งหน้า
  if (!buf) imageCache.delete(url);
  else imageCache.set(url, Promise.resolve(buf));
  return buf;
}

/**
 * @param {Blob | ArrayBuffer} templateBlob - .docx template
 * @param {Object} variables - placeholder → value
 * @returns {Promise<Blob>}
 */
export async function fillTemplate(templateBlob, variables) {
  console.time('[docxFill] total');
  console.time('[docxFill] loadLibs');
  await loadLibs();
  console.timeEnd('[docxFill] loadLibs');
  const PizZip = window.PizZip;
  const Docxtemplater = window.docxtemplater || window.Docxtemplater;
  const ImageModule = window.ImageModule;

  if (!PizZip || !Docxtemplater) {
    throw new Error('docxtemplater libraries not loaded (CDN blocked?)');
  }

  const buf = templateBlob instanceof ArrayBuffer ? templateBlob : await templateBlob.arrayBuffer();

  // เตรียมรูป — แปลง URL → ArrayBuffer แทรกใน variables
  // รวมทุก key ที่มีคำว่า signature หรือ picture, หรือค่าเป็น http URL / data URL
  const imageKeys = Object.keys(variables).filter((k) => {
    const v = variables[k];
    if (k.includes('signature') || k.includes('picture')) return true;
    if (typeof v === 'string' && /^(https?:|data:image\/)/i.test(v)) return true;
    return false;
  });

  // ดึงรูปขนาน + มี timeout + cache ตาม URL (ดู getCachedImage)
  console.time(`[docxFill] fetch ${imageKeys.length} images`);
  const imageBuffers = {};
  await Promise.all(imageKeys.map(async (k) => {
    const arr = await getCachedImage(variables[k]);
    if (arr) imageBuffers[k] = arr;
  }));
  console.timeEnd(`[docxFill] fetch ${imageKeys.length} images`);

  const zip = new PizZip(buf);
  // ใช้ delimiters {{ / }} เพื่อเข้ากับ template ของผู้ใช้ — รูปภาพ syntax = {{%name}}
  const opts = {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    delimiters: { start: '{{', end: '}}' },
  };

  // 1x1 ภาพ PNG โปร่งใส (fallback กรณีดึงรูปไม่ได้ — กัน docxtemplater error)
  const PLACEHOLDER_PNG = base64ToArrayBuffer(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  );

  if (ImageModule) {
    opts.modules = [new ImageModule({
      centered: false,
      getImage: (tagValue) => imageBuffers[tagValue] || PLACEHOLDER_PNG,
      getSize: () => [150, 60],
    })];
    // ตั้ง value ของ image key เป็น "ชื่อ key" — image module จะส่งค่านี้เข้ามาที่ getImage
    for (const k of imageKeys) {
      variables[k] = k;
    }
  }

  // ในdocxtemplater 3.x ตัว constructor ก็คอมไพล์ template เลย → error เกิดที่นี่ได้
  // เลยต้องครอบ try ทั้งบล็อก
  let doc;
  try {
    console.time('[docxFill] render');
    doc = new Docxtemplater(zip, opts);
    doc.render(variables);
    console.timeEnd('[docxFill] render');
  } catch (err) {
    console.error('[docxFill] template error:', err);
    if (err.properties) console.error('  properties:', err.properties);
    if (err.properties?.errors) {
      console.error('  errors:', err.properties.errors);
      err.properties.errors.forEach((e, i) => console.error(`    [${i}]`, e));
    }
    throw new Error(formatDocxError(err));
  }

  console.time('[docxFill] zip');
  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  console.timeEnd('[docxFill] zip');
  console.timeEnd('[docxFill] total');
  return blob;
}

function formatDocxError(err) {
  const list = err?.properties?.errors || [];
  if (list.length > 0) {
    const lines = list.map((e, i) => {
      const p = e?.properties || {};
      const tag = p.xtag || p.id || p.context || e?.name || '?';
      const exp = p.explanation || e?.message || 'unknown';
      return `  ${i + 1}. [${tag}] ${exp}`;
    });
    return `Template มี ${list.length} ข้อผิดพลาด:\n${lines.join('\n')}\n(ดูรายละเอียดเพิ่มเติมใน DevTools Console)`;
  }
  // single error — ใช้ properties.id/explanation ถ้ามี
  const p = err?.properties || {};
  const tag = p.xtag || p.id || '';
  const exp = p.explanation || err?.message || 'unknown';
  return tag ? `Template error [${tag}]: ${exp}` : `Template error: ${exp}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
