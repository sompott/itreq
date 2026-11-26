import fs from 'fs/promises';
import PizZip from 'pizzip';
import { appDB } from '../db.js';
import { getTemplatePath } from '../repositories/templates.js';

function visibleText(xml) {
  return String(xml)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function run() {
  const [types] = await appDB.query(
    `SELECT id, name, template_file
       FROM itreq_request_types
      WHERE is_active = 1
      ORDER BY sort_order, id`,
  );

  for (const type of types) {
    const templatePath = await getTemplatePath(type.id);
    const buffer = await fs.readFile(templatePath);
    const zip = new PizZip(buffer);
    const tags = new Set();
    const contexts = {};
    for (const [name, file] of Object.entries(zip.files)) {
      if (!/^word\/(document|header\d+|footer\d+)\.xml$/.test(name)) continue;
      const text = visibleText(file.asText());
      for (const match of text.matchAll(/\{\{[^}]+\}\}/g)) {
        tags.add(match[0]);
        if (/\{\{(otherhw|othernw|ad)\}\}/.test(match[0])) {
          contexts[match[0]] = text
            .slice(Math.max(0, match.index - 100), match.index + match[0].length + 100)
            .replace(/\s+/g, ' ');
        }
      }
    }
    console.log(JSON.stringify({
      id: type.id,
      name: type.name,
      template_file: type.template_file,
      size: buffer.length,
      placeholders: [...tags],
      contexts,
    }));
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => appDB.end());
