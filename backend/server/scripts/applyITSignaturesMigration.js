import fs from 'node:fs/promises';
import { appDB } from '../db.js';

try {
  const sql = await fs.readFile(new URL('../../database/add_it_signatures.sql', import.meta.url), 'utf8');
  await appDB.query(sql);
  console.log('IT signature schema ready');
} finally {
  await appDB.end();
}
