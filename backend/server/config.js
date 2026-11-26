// .env โหลดผ่าน flag --env-file=.env ในคำสั่ง npm run api
// (built-in ตั้งแต่ Node 20.6 — ไม่ต้องใช้ dotenv)

import fs from 'fs';
import path from 'path';

loadEnvFile(path.resolve(process.cwd(), '.env'));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const bool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const num = (v, def) => (v === undefined || v === '' ? def : Number(v));

export const config = {
  PORT: num(process.env.PORT, 5101),
  APP_NAME: process.env.APP_NAME || 'itrequest',
  BASE_PATH: process.env.BASE_PATH || '/itrequest',
  API_PREFIX: process.env.API_PREFIX || '/itrequest/api',
  EMP_PICTURE_BASE_URL: process.env.EMP_PICTURE_BASE_URL || 'http://www.pssugar.com/empPicture',
  SIGN_IMAGE_BASE_URL: process.env.SIGN_IMAGE_BASE_URL || 'https://www.pssugar.com/signImage',
};

export const dbConfig = {
  app: {
    host: process.env.APP_DB_HOST || '127.0.0.1',
    port: num(process.env.APP_DB_PORT, 3306),
    user: process.env.APP_DB_USER || 'root',
    password: process.env.APP_DB_PASSWORD || '',
    database: process.env.APP_DB_NAME || 'dbps_itreq',
  },
  emp: {
    host: process.env.EMP_DB_HOST || '',
    port: num(process.env.EMP_DB_PORT, 3306),
    user: process.env.EMP_DB_USER || '',
    password: process.env.EMP_DB_PASSWORD || '',
    database: process.env.EMP_DB_NAME || '',
  },
  itService: {
    host: process.env.IT_SERVICE_DB_HOST || process.env.APP_DB_HOST || '127.0.0.1',
    port: num(process.env.IT_SERVICE_DB_PORT || process.env.APP_DB_PORT, 3306),
    user: process.env.IT_SERVICE_DB_USER || process.env.APP_DB_USER || 'root',
    password: process.env.IT_SERVICE_DB_PASSWORD || process.env.APP_DB_PASSWORD || '',
    database: process.env.IT_SERVICE_DB_NAME || 'dbps',
  },
  itServiceEmp: {
    host: process.env.IT_SERVICE_EMP_DB_HOST || process.env.EMP_DB_HOST || process.env.IT_SERVICE_DB_HOST || '127.0.0.1',
    port: num(process.env.IT_SERVICE_EMP_DB_PORT || process.env.EMP_DB_PORT || process.env.IT_SERVICE_DB_PORT, 3306),
    user: process.env.IT_SERVICE_EMP_DB_USER || process.env.EMP_DB_USER || process.env.IT_SERVICE_DB_USER || 'root',
    password: process.env.IT_SERVICE_EMP_DB_PASSWORD || process.env.EMP_DB_PASSWORD || process.env.IT_SERVICE_DB_PASSWORD || '',
    database: process.env.IT_SERVICE_EMP_DB_NAME || 'dbps2',
  },
};

export const empDBEnabled = Boolean(dbConfig.emp.host && dbConfig.emp.database);
export const itServiceDBEnabled = Boolean(dbConfig.itService.host && dbConfig.itService.database);
export const itServiceEmpDBEnabled = Boolean(dbConfig.itServiceEmp.host && dbConfig.itServiceEmp.database);

export const authConfig = {
  decryptionKey: process.env.PSWEB2_DECRYPTION_KEY || '',
  iisLoginUrl: process.env.IIS_LOGIN_URL || 'http://10.104.1.12/psweb2/login.aspx',
  appId: num(process.env.PSWEB2_APP_ID, 0),
};

export const ssoEnabled = Boolean(authConfig.decryptionKey);

export const smtpConfig = {
  host: process.env.SMTP_HOST || '',
  port: num(process.env.SMTP_PORT, 587),
  secure: bool(process.env.SMTP_SECURE, false),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || '',
};

export const smtpEnabled = Boolean(smtpConfig.host && smtpConfig.user);

export const telegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatIds: (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export const telegramEnabled = Boolean(telegramConfig.botToken && telegramConfig.chatIds.length);

export const notebookApiConfig = {
  url: process.env.NOTEBOOK_API_URL || 'https://www.pssugar.com/PS_MeetingRoom/GetBookingNB.ashx',
};

export const getEmpPicture = (empCode) => `${config.EMP_PICTURE_BASE_URL}/${empCode}.jpg`;
export const getEmpSignature = (empCode) => `${config.SIGN_IMAGE_BASE_URL}/${empCode}.PNG`;
