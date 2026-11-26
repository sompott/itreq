/**
 * Render Word template ฝั่ง server — fill variables + แทรกรูปลายเซ็น
 * (ย้ายจาก client/docxFill.js เพราะ image-module-free มีบั๊กกับ DOM ใน browser ใหม่)
 */
import fs from 'fs/promises';
import { createRequire } from 'module';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { signatureFilePath } from './repositories/signatures.js';

// image-module-free เป็น CJS, ดึงผ่าน createRequire
const require = createRequire(import.meta.url);
const ImageModule = require('docxtemplater-image-module-free');

// 1x1 PNG โปร่งใส — ใส่แทนเมื่อโหลดรูปจริงไม่ได้
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * fill template + แทรกรูปจาก URL/path
 * @param {string} templatePath  path เต็มของไฟล์ .docx (บน NAS)
 * @param {Object} variables     ตัวแปร (key → value)
 * @returns {Promise<Buffer>}    บัฟเฟอร์ของ .docx ที่ render เสร็จ
 */
export async function renderDocx(templatePath, variables, options = {}) {
  const templateBuf = await fs.readFile(templatePath);

  // หา image keys ทั้งหมด
  const imageKeys = Object.keys(variables).filter((k) => {
    const v = variables[k];
    if (k.includes('signature') || k.includes('picture')) return true;
    if (typeof v === 'string' && /^(https?:|data:image\/)/i.test(v)) return true;
    return false;
  });

  // ดึงไฟล์รูปขนาน — local file (NAS) หรือ external URL
  const imageBuffers = {};
  await Promise.all(imageKeys.map(async (k) => {
    const buf = await loadImage(variables[k]);
    if (buf) imageBuffers[k] = buf;
  }));

  const zip = new PizZip(templateBuf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    delimiters: { start: '{{', end: '}}' },
    modules: [new ImageModule({
      centered: false,
      getImage: (tagValue) => imageBuffers[tagValue] || PLACEHOLDER_PNG,
      getSize: () => [110, 44],
    })],
  });

  // ตั้ง value ของ image key เป็นชื่อ key เพื่อให้ image module ค้นใน imageBuffers
  for (const k of imageKeys) variables[k] = k;

  doc.render(variables);
  const out = doc.getZip();
  if (options.appendImages?.length) {
    await appendImagesToDocument(out, options.appendImages);
  }
  return out.generate({ type: 'nodebuffer' });
}

async function appendImagesToDocument(zip, images) {
  const docFile = zip.file('word/document.xml');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const typesFile = zip.file('[Content_Types].xml');
  if (!docFile || !relsFile || !typesFile) return;

  let documentXml = docFile.asText();
  let relsXml = relsFile.asText();
  let contentTypesXml = typesFile.asText();
  const existingRidNums = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  let nextRid = Math.max(0, ...existingRidNums) + 1;
  let nextDocPr = 9000;
  const bodyEnd = '</w:body>';
  const insertParts = [];

  for (const [idx, image] of images.entries()) {
    let buf;
    try {
      buf = await fs.readFile(image.full_path);
    } catch {
      continue;
    }
    const ext = imageExtension(image);
    const mediaName = `attachment_${image.id || idx + 1}.${ext}`;
    const rid = `rId${nextRid++}`;
    zip.file(`word/media/${mediaName}`, buf);
    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
    );
    contentTypesXml = ensureImageContentType(contentTypesXml, ext);
    insertParts.push(imageParagraphXml({
      rid,
      docPrId: nextDocPr++,
      name: image.file_name || mediaName,
      first: idx === 0,
    }));
  }

  if (!insertParts.length) return;
  documentXml = documentXml.replace(bodyEnd, `${insertParts.join('')}${bodyEnd}`);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', relsXml);
  zip.file('[Content_Types].xml', contentTypesXml);
}

function imageExtension(image) {
  const mime = String(image.mime_type || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  const ext = String(image.file_name || '').split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'png';
}

function ensureImageContentType(xml, ext) {
  const type = {
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  }[ext] || 'image/png';
  if (xml.includes(`Extension="${ext}"`)) return xml;
  return xml.replace(
    '</Types>',
    `<Default Extension="${ext}" ContentType="${type}"/></Types>`,
  );
}

function imageParagraphXml({ rid, docPrId, name, first }) {
  const cx = 5486400; // 6 inches
  const cy = 3657600; // 4 inches
  return `
    <w:p>
      <w:r><w:br w:type="page"/></w:r>
    </w:p>
    ${first ? '<w:p><w:r><w:t>รูปภาพแนบ</w:t></w:r></w:p>' : ''}
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:docPr id="${docPrId}" name="${escapeXml(name)}"/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="${escapeXml(name)}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${rid}"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadImage(url) {
  if (!url || typeof url !== 'string') return null;

  // data URL
  if (url.startsWith('data:')) {
    const m = url.match(/^data:[^;]+;base64,(.+)$/);
    return m ? Buffer.from(m[1], 'base64') : null;
  }

  // local NAS signature: /itrequest/api/signatures/<filename>
  const sigMatch = url.match(/\/signatures\/([^/?#]+)$/);
  if (sigMatch) {
    const filename = decodeURIComponent(sigMatch[1]);
    if (!filename || /[\\/]|\.\./.test(filename)) return null;
    const filepath = signatureFilePath(filename);
    if (!filepath) return null;
    try {
      return await fs.readFile(filepath);
    } catch {
      return null;
    }
  }

  // external URL
  if (/^https?:\/\//i.test(url)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }

  return null;
}
