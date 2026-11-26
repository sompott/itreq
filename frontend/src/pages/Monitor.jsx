import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, CheckCircle, Laptop, CalendarDays, Clock } from 'lucide-react';
import { api } from '../lib/api.js';

const NOTEBOOK_API_URL = import.meta.env.VITE_NOTEBOOK_API_URL || 'https://www.pssugar.com/PS_MeetingRoom/GetBookingNB.ashx';
const REFRESH_MS = 15000;

export default function MonitorPage() {
  const [jobs, setJobs] = useState([]);
  const [acceptedItems, setAcceptedItems] = useState([]);
  const [notebookItems, setNotebookItems] = useState([]);
  const [now, setNow] = useState(new Date());

  async function loadJobs() {
    try {
      const data = await api('/it-services/jobs?status=open');
      setJobs(data.jobs || []);
    } catch {}
  }

  async function loadAccepted() {
    try {
      const data = await api('/requests/it-queue');
      setAcceptedItems((data.items || []).filter((item) => ['approved', 'in_progress', 'completed'].includes(item.status)));
    } catch {}
  }

  async function loadNotebook() {
    try {
      setNotebookItems(await fetchTodayNotebookRequests());
    } catch {}
  }

  function loadAll() {
    loadJobs();
    loadAccepted();
    loadNotebook();
  }

  useEffect(() => {
    loadAll();
    const handle = setInterval(loadAll, REFRESH_MS);
    const clockHandle = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(handle);
      clearInterval(clockHandle);
    };
  }, []);

  const openJobs = jobs.filter((j) => !j.status);
  const closedToday = jobs.filter((j) => j.status).length;
  const acknowledged = openJobs.filter((j) => j.acknowledge).length;
  const waitingAck = openJobs.length - acknowledged;
  const inProgressItems = acceptedItems.filter((i) => i.status === 'in_progress');
  const waitingItems = acceptedItems.filter((i) => i.status === 'approved');
  const completedItems = acceptedItems.filter((i) => i.status === 'completed');

  return (
    <div className="monitor-page">
      <header className="monitor-header">
        <div className="monitor-brand">
          <span className="brand-mark">IT</span>
          <div>
            <h1>IT Services Monitor</h1>
            <small>แผนกเทคโนโลยีสารสนเทศ - ภาพรวมงานบริการ</small>
          </div>
        </div>
        <div className="monitor-clock">
          <div className="clock-time">{formatClock(now)}</div>
          <div className="clock-date">{formatFullDate(now)}</div>
        </div>
      </header>

      <section className="monitor-stats">
        <StatCard label="งานเปิดอยู่" value={openJobs.length} accent="primary" icon={<BriefcaseBusiness size={28} />} />
        <StatCard label="รอรับทราบ" value={waitingAck} accent="warning" icon={<Clock size={28} />} />
        <StatCard label="รับทราบแล้ว" value={acknowledged} accent="info" icon={<CheckCircle size={28} />} />
        <StatCard label="ปิดงานแล้ว" value={closedToday} accent="success" icon={<CheckCircle size={28} />} />
        <StatCard label="กำลังดำเนินงาน" value={inProgressItems.length} accent="info" icon={<Clock size={28} />} />
        <StatCard label="Notebook วันนี้" value={notebookItems.length} accent="primary" icon={<Laptop size={28} />} />
      </section>

      <div className="monitor-grid">
        <section className="monitor-card">
          <div className="monitor-card-head">
            <h2><BriefcaseBusiness size={22} /> งาน IT Services ที่เปิดอยู่</h2>
            <span className="monitor-count">{openJobs.length} รายการ</span>
          </div>
          <div className="monitor-card-body">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ประเภท</th>
                  <th>รายละเอียด</th>
                  <th>ผู้ขอ</th>
                  <th>ผู้รับผิดชอบ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {openJobs.slice(0, 12).map((job) => (
                  <tr key={job.id}>
                    <td><b>#{job.id}</b></td>
                    <td><b>{job.type}</b></td>
                    <td className="monitor-detail">{job.details || '-'}</td>
                    <td>{job.applicant_name || job.service_applicant}</td>
                    <td>{job.provider_name || job.service_provider}</td>
                    <td><ServiceStatus job={job} /></td>
                  </tr>
                ))}
                {openJobs.length === 0 ? (
                  <tr><td colSpan={6} className="monitor-empty">ไม่มีงานเปิดอยู่</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="monitor-card">
          <div className="monitor-card-head">
            <h2><CheckCircle size={22} /> งาน IT รับแล้ว</h2>
            <span className="monitor-count">{acceptedItems.length} รายการ</span>
          </div>
          <div className="monitor-card-body">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>หัวข้อ</th>
                  <th>ประเภท</th>
                  <th>ผู้ขอ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {[...inProgressItems, ...waitingItems, ...completedItems].slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.request_no}</b></td>
                    <td className="monitor-detail">{item.title}</td>
                    <td>{item.request_type_name}</td>
                    <td>{item.requester_emp_id}</td>
                    <td><ITRequestStatus status={item.status} /></td>
                  </tr>
                ))}
                {acceptedItems.length === 0 ? (
                  <tr><td colSpan={5} className="monitor-empty">ยังไม่มีรายการ</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="monitor-card monitor-card-wide">
          <div className="monitor-card-head">
            <h2><Laptop size={22} /> ขอใช้ Notebook วันนี้</h2>
            <span className="monitor-count">{notebookItems.length} รายการ</span>
          </div>
          <div className="monitor-card-body">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>เรื่อง</th>
                  <th>ผู้ขอ</th>
                  <th>ช่วงเวลา</th>
                  <th>จำนวน</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {notebookItems.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>#{item.id} {item.title}</b>
                      {item.room ? <small className="row-subtext">{item.room}</small> : null}
                    </td>
                    <td>
                      {item.requester_name || item.requester_emp_id}
                      {item.department ? <small className="row-subtext">{item.department}</small> : null}
                    </td>
                    <td>
                      <CalendarDays size={14} /> {formatTime(item.start_at)}
                      <small className="row-subtext">ถึง {formatTime(item.end_at)}</small>
                    </td>
                    <td><b>{item.notebook_qty}</b></td>
                    <td><NotebookStatus status={item.status} /></td>
                  </tr>
                ))}
                {notebookItems.length === 0 ? (
                  <tr><td colSpan={5} className="monitor-empty">ไม่พบรายการขอใช้ Notebook</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="monitor-footer">
        <small>อัปเดตอัตโนมัติทุก {REFRESH_MS / 1000} วินาที - ล่าสุด {formatClock(now)}</small>
      </footer>
    </div>
  );
}

function StatCard({ label, value, accent, icon }) {
  return (
    <div className={`monitor-stat ${accent}`}>
      <div className="monitor-stat-icon">{icon}</div>
      <div className="monitor-stat-body">
        <div className="monitor-stat-value">{value}</div>
        <div className="monitor-stat-label">{label}</div>
      </div>
    </div>
  );
}

function ServiceStatus({ job }) {
  if (job.status) return <span className="pill done">ปิดงานแล้ว</span>;
  if (job.acknowledge) return <span className="pill progress">รับทราบแล้ว</span>;
  return <span className="pill pending">รอรับทราบ</span>;
}

function ITRequestStatus({ status }) {
  const map = {
    approved: ['progress', 'รอรับงาน'],
    in_progress: ['pending', 'รับงานแล้ว'],
    completed: ['done', 'เสร็จสิ้น'],
  };
  const [className, label] = map[status] || ['pending', status || '-'];
  return <span className={`pill ${className}`}>{label}</span>;
}

function NotebookStatus({ status }) {
  const map = {
    pending: ['pending', 'รออนุมัติ'],
    approved: ['progress', 'อนุมัติแล้ว'],
    rejected: ['danger', 'ไม่อนุมัติ'],
    returned: ['done', 'คืนแล้ว'],
    cancelled: ['done', 'ยกเลิก'],
  };
  const [className, label] = map[status] || ['pending', status || '-'];
  return <span className={`pill ${className}`}>{label}</span>;
}

async function fetchTodayNotebookRequests() {
  try {
    return await fetchTodayNotebookRequestsDirect();
  } catch {
    const data = await api('/it-services/notebook-requests?status=all');
    return (data.requests || []).map(normalizeNotebookApiItem);
  }
}

async function fetchTodayNotebookRequestsDirect() {
  const today = bangkokDateText(new Date());
  const url = new URL(NOTEBOOK_API_URL);
  url.searchParams.set('start', `${today}T00:00:00+07:00`);
  url.searchParams.set('end', `${today}T23:59:59+07:00`);
  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: { Accept: 'application/json, text/javascript, */*; q=0.01' },
  });
  if (!response.ok) throw new Error(`notebook_api_http_${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data) ? data : data?.data || data?.items || data?.bookings || [];
  return rows
    .filter((item) => needsNotebookOrConference(item))
    .filter((item) => occursToday(item, today))
    .map(normalizeNotebookItem);
}

function normalizeNotebookApiItem(item) {
  return {
    id: item.id,
    title: item.title || '-',
    requester_name: item.requester_name || '',
    requester_emp_id: item.requester_emp_id || '',
    department: item.department || '',
    room: item.room || '',
    start_at: item.start_at || null,
    end_at: item.end_at || null,
    notebook_qty: item.notebook_qty || 0,
    note: item.note || '',
    status: item.status || 'approved',
  };
}

function normalizeNotebookItem(item, index) {
  const nbText = item.nb || item.notebook || item.note || '';
  return {
    id: Number(item.id || item.ID || index + 1),
    title: item.title || item.Title || '-',
    requester_name: item.booker || item.requester_name || item.name || '',
    requester_emp_id: item.emp_code || '',
    department: item.dept || item.department || '',
    room: item.room || '',
    start_at: item.start || item.start_at || null,
    end_at: item.end || item.end_at || null,
    notebook_qty: extractNotebookQty(nbText),
    note: [
      nbText,
      item.conf === 'ต้องการ' ? 'ต้องการระบบประชุม' : '',
      item.contact3 ? `ต่อ ${item.contact3}` : '',
    ].filter(Boolean).join(' / '),
    status: 'approved',
  };
}

function needsNotebookOrConference(item) {
  const nb = String(item.nb || item.notebook || '').trim();
  const conf = String(item.conf || '').trim();
  return Boolean(nb && nb !== 'ไม่ต้องการ') || conf === 'ต้องการ';
}

function occursToday(item, today) {
  return String(item.start || item.start_at || '').split('T')[0] === today
    || String(item.end || item.end_at || '').split('T')[0] === today;
}

function extractNotebookQty(text) {
  const match = String(text || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function bangkokDateText(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatClock(date) {
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(date);
}
