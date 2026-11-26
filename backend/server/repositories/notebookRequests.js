import http from 'http';
import https from 'https';
import { notebookApiConfig } from '../config.js';

function normalizeNotebookItem(item, index) {
  const startAt = item.start_at || item.start || item.Start || item.DateStart || item.date_start;
  const endAt = item.end_at || item.end || item.End || item.DateEnd || item.date_end;
  const nbText = item.nb || item.notebook || item.notebook_text || item.note || '';
  const qty = item.notebook_qty || item.qty || extractQty(nbText);

  return {
    id: Number(item.id || item.ID || index + 1),
    title: item.title || item.Title || item.subject || item.Subject || '-',
    requester_emp_id: item.requester_emp_id || item.emp_code || item.booker_emp_id || '',
    requester_name: item.requester_name || item.booker || item.Booker || item.name || '',
    department: item.department || item.dept || item.Dept || '',
    room: item.room || item.Room || '',
    start_at: startAt || null,
    end_at: endAt || null,
    notebook_qty: Number(qty || 0),
    note: nbText || item.description || '',
    status: item.status || item.Status || 'approved',
    approved_by: item.approved_by || null,
    approved_at: item.approved_at || null,
    returned_at: item.returned_at || null,
    created_at: item.created_at || startAt || null,
    updated_at: item.updated_at || null,
    raw: item,
  };
}

function extractQty(text) {
  const match = String(text || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function filterByStatus(items, status) {
  if (!status || status === 'all') return items;
  if (status === 'active') return items.filter((item) => ['pending', 'approved', 'active'].includes(String(item.status)));
  return items.filter((item) => String(item.status) === status);
}

function overlaps(item, from, to) {
  if (!from && !to) return true;
  const start = item.start_at ? new Date(item.start_at).getTime() : null;
  const end = item.end_at ? new Date(item.end_at).getTime() : null;
  if (!start || !end) return true;
  const fromTs = from ? new Date(from).getTime() : -Infinity;
  const toTs = to ? new Date(to).getTime() : Infinity;
  return start <= toTs && end >= fromTs;
}

export async function listNotebookRequests({ status = 'active', from, to, requesterEmpId, cookie = '' } = {}) {
  const range = normalizeRange(from, to);
  const rows = await fetchNotebookApi({ ...range, cookie });
  return rows
    .map(normalizeNotebookItem)
    .filter((item) => needsNotebookOrConference(item.raw))
    .filter((item) => filterByStatus([item], status).length > 0)
    .filter((item) => !range.todayOnly || occursOnDate(item, range.date))
    .filter((item) => overlaps(item, range.from, range.to))
    .filter((item) => !requesterEmpId || item.requester_emp_id === requesterEmpId);
}

export async function getNotebookRequest(id) {
  const rows = await listNotebookRequests({ status: 'all' });
  return rows.find((item) => item.id === Number(id)) || null;
}

export async function getNotebookUsage({ from, to, cookie = '' } = {}) {
  const requests = (await listNotebookRequests({ status: 'active', from, to, cookie }))
    .filter((item) => item.notebook_qty > 0);
  return {
    total_qty: requests.reduce((sum, item) => sum + item.notebook_qty, 0),
    requests,
  };
}

export async function createNotebookRequest() {
  throw Object.assign(new Error('notebook_api_read_only'), { httpStatus: 405 });
}

export async function updateNotebookRequestStatus() {
  throw Object.assign(new Error('notebook_api_read_only'), { httpStatus: 405 });
}

export async function deleteNotebookRequest() {
  throw Object.assign(new Error('notebook_api_read_only'), { httpStatus: 405 });
}

async function fetchNotebookApi({ from, to, cookie = '' } = {}) {
  if (!notebookApiConfig.url) return [];
  const data = await requestJson(buildNotebookUrl(notebookApiConfig.url, from, to), cookie);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.bookings)) return data.bookings;
  return [];
}

function needsNotebookOrConference(item = {}) {
  const nb = String(item.nb || item.notebook || item.notebook_text || '').trim();
  const conf = String(item.conf || item.conference || '').trim();
  return Boolean(nb && nb !== 'ไม่ต้องการ') || conf === 'ต้องการ';
}

function normalizeRange(from, to) {
  if (from || to) return { from, to, todayOnly: false, date: null };
  const today = new Date();
  const bangkok = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);
  return {
    from: `${bangkok}T00:00:00+07:00`,
    to: `${bangkok}T23:59:59+07:00`,
    todayOnly: true,
    date: bangkok,
  };
}

function occursOnDate(item, dateText) {
  if (!dateText) return true;
  return toBangkokDate(item.start_at) === dateText || toBangkokDate(item.end_at) === dateText;
}

function toBangkokDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildNotebookUrl(baseUrl, from, to) {
  const url = new URL(baseUrl);
  if (from && !url.searchParams.has('start')) url.searchParams.set('start', from);
  if (to && !url.searchParams.has('end')) url.searchParams.set('end', to);
  return url.toString();
}

function requestJson(url, cookie = '') {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: 'https://www.pssugar.com/PS_ITServices/Job.aspx',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
    };
    if (cookie) headers.Cookie = cookie;
    const req = client.get(url, { timeout: 15000, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(Object.assign(new Error(`notebook_api_http_${res.statusCode}`), { httpStatus: 502 }));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(Object.assign(new Error('notebook_api_invalid_json'), { httpStatus: 502, cause: err }));
        }
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('notebook_api_timeout'), { httpStatus: 504 })));
    req.on('error', reject);
  });
}
