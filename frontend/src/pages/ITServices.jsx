import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle, Clock, Laptop, Monitor, Plus, Tags, Trash2, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { navigate } from '../lib/useHashRoute.js';

const NOTEBOOK_API_URL = import.meta.env.VITE_NOTEBOOK_API_URL || 'https://www.pssugar.com/PS_MeetingRoom/GetBookingNB.ashx';

function AutoScrollViewport({ children, label }) {
  const viewportRef = React.useRef(null);
  const stoppedByUser = React.useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    let timerId = 0;
    let pauseUntil = Date.now() + 900;
    let direction = 1;

    function stopAutoScroll() {
      if (stoppedByUser.current) return;
      stoppedByUser.current = true;
      viewport.dataset.autoScroll = 'stopped';
      clearInterval(timerId);
    }

    function stopForScrollKey(event) {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        stopAutoScroll();
      }
    }

    function tick() {
      if (stoppedByUser.current) return;

      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (maxScroll <= 1) {
        viewport.dataset.autoScroll = 'idle';
        return;
      }

      viewport.dataset.autoScroll = 'running';
      if (Date.now() < pauseUntil) return;

      viewport.scrollTop += direction;

      if (direction > 0 && viewport.scrollTop >= maxScroll - 1) {
        viewport.scrollTop = maxScroll;
        direction = -1;
        pauseUntil = Date.now() + 1200;
      } else if (direction < 0 && viewport.scrollTop <= 1) {
        viewport.scrollTop = 0;
        direction = 1;
        pauseUntil = Date.now() + 1200;
      }
    }

    const stopOnScrollbar = (event) => {
      if (event.target === viewport) stopAutoScroll();
    };

    viewport.addEventListener('wheel', stopAutoScroll, { passive: true });
    viewport.addEventListener('touchstart', stopAutoScroll, { passive: true });
    viewport.addEventListener('pointerdown', stopOnScrollbar);
    viewport.addEventListener('keydown', stopForScrollKey);
    timerId = window.setInterval(tick, 80);

    return () => {
      clearInterval(timerId);
      viewport.removeEventListener('wheel', stopAutoScroll);
      viewport.removeEventListener('touchstart', stopAutoScroll);
      viewport.removeEventListener('pointerdown', stopOnScrollbar);
      viewport.removeEventListener('keydown', stopForScrollKey);
    };
  }, []);

  return (
    <div ref={viewportRef} className="auto-scroll-viewport" tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}

export default function ITServicesPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [activeAction, setActiveAction] = useState('');

  async function loadJobs(options = {}) {
    const silent = options.silent === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await api('/it-services/jobs?status=open');
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลงานไม่สำเร็จ');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { loadJobs(); }, []);

  useEffect(() => {
    const handle = setInterval(() => {
      if (showCreate || showTypes || activeJob) return;
      loadJobs({ silent: true });
    }, 15000);
    return () => clearInterval(handle);
  }, [showCreate, showTypes, activeJob]);

  function openJobAction(job, action) {
    setActiveJob(job);
    setActiveAction(action);
  }

  return (
    <div className="page it-services-page">
      <section className="card it-services-hub-card">
        <div className="it-services-section it-services-jobs-section">
        <div className="table-toolbar it-services-main-toolbar">
          <div>
            <h2 className="section-title"><BriefcaseBusiness size={19} /> งานบริการ IT Services</h2>
          </div>
          <div className="action-row page-actions">
            <button className="btn" onClick={() => setShowTypes(true)}>
              <Tags size={16} /> เพิ่มประเภท
            </button>
            <button className="btn" onClick={() => window.open(`${window.location.pathname}#/it-services/monitor`, '_blank')}>
              <Monitor size={16} /> Monitor
            </button>
            <button className="btn" onClick={() => navigate('/it-services/report')}>
              <BarChart3 size={16} /> รายงาน
            </button>
            <button className="btn primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> เปิดงาน IT
            </button>
          </div>
        </div>

        <AutoScrollViewport label="ตารางงานบริการ IT Services">
          {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}
          {loading ? <p className="muted">กำลังโหลด...</p> : (
            <table className="data-table">
            <thead>
              <tr>
                <th>เลขงาน</th>
                <th>ประเภท</th>
                <th>รายละเอียด</th>
                <th>ผู้ขอ</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td><b>#{job.id}</b></td>
                  <td><b>{job.type}</b></td>
                  <td className="it-service-detail-cell" title={job.details || '-'}>
                    <span className="desktop-scroll-text">{job.details || '-'}</span>
                  </td>
                  <td>{job.applicant_name || job.service_applicant}</td>
                  <td>{job.provider_name || job.service_provider}</td>
                  <td className="service-status-cell"><ServiceStatus job={job} /></td>
                  <td>
                    <small>{job.date_start ? formatDate(job.date_start) : '-'}</small>
                    {job.datetime_job ? <small className="row-subtext">รับงาน {job.datetime_job}</small> : null}
                  </td>
                  <td>
                    <div className="action-row it-service-actions">
                      {!job.status ? (
                        <>
                          <button className={`btn small ${job.acknowledge ? 'success' : 'primary'}`} onClick={() => openJobAction(job, 'ack')}>
                            {job.acknowledge ? 'รับทราบแล้ว' : 'รับทราบ'}
                          </button>
                          <button className={`btn small ${job.overwork ? 'success' : ''}`} onClick={() => openJobAction(job, 'overwork')}>
                            {job.overwork ? 'ข้ามวันแล้ว' : 'งานข้ามวัน'}
                          </button>
                          <button className="btn small danger" onClick={() => openJobAction(job, 'close')}>ปิดงาน</button>
                        </>
                      ) : (
                        <button className="btn small" onClick={() => openJobAction(job, 'reopen')}>เปิดงาน</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr><td colSpan={8} className="empty-cell">ไม่พบรายการ</td></tr>
              ) : null}
            </tbody>
            </table>
          )}
        </AutoScrollViewport>
        </div>

        <AcceptedITRequestsSection />

        <NotebookRequestsSection />
      </section>

      {showCreate ? (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            loadJobs();
          }}
        />
      ) : null}

      {showTypes ? (
        <ServiceTypeModal onClose={() => setShowTypes(false)} />
      ) : null}

      {activeJob ? (
        <JobActionModal
          job={activeJob}
          actionMode={activeAction}
          onClose={() => {
            setActiveJob(null);
            setActiveAction('');
          }}
          onChanged={(job) => {
            setActiveJob(job);
            loadJobs();
          }}
          onDeleted={() => {
            setActiveJob(null);
            setActiveAction('');
            loadJobs();
          }}
        />
      ) : null}
    </div>
  );
}

function ServiceStatus({ job }) {
  if (job.status) return <span className="pill done">ปิดงานแล้ว</span>;
  if (job.acknowledge) return <span className="pill progress">รับทราบแล้ว</span>;
  return <span className="pill pending">รอรับทราบ</span>;
}

function AcceptedITRequestsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [actionTarget, setActionTarget] = useState(null);
  const [error, setError] = useState('');

  async function loadItems(options = {}) {
    if (!options.silent) setLoading(true);
    setError('');
    try {
      const data = await api('/requests/it-queue');
      setItems((data.items || []).filter((item) => ['approved', 'in_progress', 'completed'].includes(item.status)));
    } catch (err) {
      setError(err.message || 'โหลดรายการรับงานจากแบบฟอร์มไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(item, status, note) {
    setBusyId(`${item.id}:${status}`);
    setError('');
    try {
      await api(`/requests/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
      setActionTarget(null);
      await loadItems({ silent: true });
    } catch (err) {
      setError(err.message || 'อัปเดตสถานะงานไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => {
    loadItems();
    const handle = setInterval(() => loadItems({ silent: true }), 15000);
    return () => clearInterval(handle);
  }, []);

  return (
    <section className="it-services-section accepted-requests-section">
      <div className="table-toolbar">
        <div>
          <h2 className="section-title"><CheckCircle size={19} /> รายการที่ IT รับงานแล้ว</h2>
        </div>
      </div>

      <AutoScrollViewport label="ตารางรายการที่ IT รับงานแล้ว">
        {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}
        {loading ? <p className="muted">กำลังโหลด...</p> : (
          <table className="data-table">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>หัวข้อ</th>
              <th>ประเภท</th>
              <th>ผู้ขอ</th>
              <th>สถานะ</th>
              <th>วันที่สร้าง</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><b>{item.request_no}</b></td>
                <td title={item.title}><span className="desktop-scroll-text">{item.title}</span></td>
                <td>{item.request_type_name}</td>
                <td>{item.requester_emp_id}</td>
                <td className="service-status-cell"><ITRequestStatus status={item.status} /></td>
                <td>{formatDate(item.created_at)}</td>
                <td>
                  <div className="action-row accepted-request-actions">
                    {item.status === 'approved' ? (
                      <button className="btn small primary" disabled={busyId === `${item.id}:in_progress`} onClick={() => setActionTarget({ item, status: 'in_progress' })}>
                        รับงาน
                      </button>
                    ) : null}
                    {item.status === 'in_progress' ? (
                      <button className="btn small success" disabled={busyId === `${item.id}:completed`} onClick={() => setActionTarget({ item, status: 'completed' })}>
                        เสร็จสิ้น
                      </button>
                    ) : null}
                    {item.status === 'completed' ? (
                      <button className="btn small" disabled={busyId === `${item.id}:closed`} onClick={() => setActionTarget({ item, status: 'closed' })}>
                        ปิดงาน
                      </button>
                    ) : null}
                    <button className="btn small" onClick={() => navigate(`/staff/${item.id}`)}>
                      เปิดงาน
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr><td colSpan={7} className="empty-cell">ยังไม่มีรายการที่ IT รับงานแล้ว</td></tr>
            ) : null}
          </tbody>
          </table>
        )}
      </AutoScrollViewport>
      {actionTarget ? (
        <ITServiceQueueActionModal
          target={actionTarget}
          busy={busyId === `${actionTarget.item.id}:${actionTarget.status}`}
          onClose={() => setActionTarget(null)}
          onSubmit={(note) => updateStatus(actionTarget.item, actionTarget.status, note)}
        />
      ) : null}
    </section>
  );
}

function ITServiceQueueActionModal({ target, busy, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const title = {
    in_progress: 'รับงาน',
    completed: 'เสร็จสิ้น',
    closed: 'ปิดงาน',
  }[target.status] || 'อัปเดตสถานะ';

  function submit() {
    const trimmed = note.trim();
    if (!trimmed) {
      setError('กรุณากรอกหมายเหตุก่อนยืนยัน');
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}: {target.item.request_no}</h2>
          <button className="icon-btn" onClick={onClose} disabled={busy}><X size={16} /></button>
        </div>
        <div className="job-detail-box">
          <b>{target.item.title}</b>
          <small>{target.item.request_type_name}</small>
          <small>ผู้ขอ: {target.item.requester_emp_id}</small>
        </div>
        <label className="field">
          <span>หมายเหตุ <b>*</b></span>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (error) setError('');
            }}
            placeholder="ระบุรายละเอียดการดำเนินการ"
          />
        </label>
        {error ? <p className="modal-error">{error}</p> : null}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  );
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

function NotebookRequestsSection() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadRequests(options = {}) {
    const silent = options.silent === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      setRequests(await fetchTodayNotebookRequests());
    } catch (err) {
      setError('โหลดข้อมูล Notebook ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การเข้าใช้งาน PS MeetingRoom');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    const handle = setInterval(() => loadRequests({ silent: true }), 15000);
    return () => clearInterval(handle);
  }, []);

  return (
    <section className="it-services-section notebook-section">
      <div className="table-toolbar">
        <div>
          <h2 className="section-title"><Laptop size={19} /> ขอใช้ Notebook</h2>
        </div>
      </div>

      <AutoScrollViewport label="ตารางรายการขอใช้ Notebook">
        {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}
        {loading ? <p className="muted">กำลังโหลด...</p> : (
          <table className="data-table">
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
            {requests.map((item) => (
              <tr key={item.id}>
                <td>
                  <b className="desktop-scroll-text">#{item.id} {item.title}</b>
                  <small className="row-subtext desktop-scroll-text" title={`${item.room || '-'} ${item.note ? `- ${item.note}` : ''}`}>
                    {item.room || '-'} {item.note ? `- ${item.note}` : ''}
                  </small>
                </td>
                <td>
                  {item.requester_name || item.requester_emp_id}
                  <small className="row-subtext">{item.department || item.requester_emp_id}</small>
                </td>
                <td>
                  <CalendarDays size={14} /> {formatDate(item.start_at)}
                  <small className="row-subtext">ถึง {formatDate(item.end_at)}</small>
                </td>
                <td>{item.notebook_qty}</td>
                <td className="service-status-cell"><NotebookStatus status={item.status} /></td>
              </tr>
            ))}
            {requests.length === 0 ? (
              <tr><td colSpan={5} className="empty-cell">ไม่พบรายการขอใช้ Notebook</td></tr>
            ) : null}
          </tbody>
          </table>
        )}
      </AutoScrollViewport>
    </section>
  );
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

function ServiceTypeModal({ onClose }) {
  const [types, setTypes] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function loadTypes() {
    setError('');
    try {
      const data = await api('/it-services/type-records');
      setTypes(data.types || []);
    } catch (err) {
      setError(err.message || 'โหลดประเภทงานไม่สำเร็จ');
    }
  }

  useEffect(() => { loadTypes(); }, []);

  async function createType(e) {
    e.preventDefault();
    setBusy('create');
    setError('');
    try {
      await api('/it-services/types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setName('');
      await loadTypes();
    } catch (err) {
      setError(err.message || 'เพิ่มประเภทไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function saveType(id) {
    setBusy(`save-${id}`);
    setError('');
    try {
      await api(`/it-services/types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName }),
      });
      setEditingId(null);
      setEditingName('');
      await loadTypes();
    } catch (err) {
      setError(err.message || 'แก้ไขประเภทไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function removeType(id) {
    if (!confirm('ลบประเภทนี้?')) return;
    setBusy(`delete-${id}`);
    setError('');
    try {
      await api(`/it-services/types/${id}`, { method: 'DELETE' });
      await loadTypes();
    } catch (err) {
      setError(err.message || 'ลบประเภทไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  return (
    <Modal title="เพิ่มประเภทงาน IT" onClose={onClose}>
      {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}
      <form className="inline-form" onSubmit={createType}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อประเภทงาน"
          required
        />
        <button className="btn primary" disabled={busy === 'create' || !name.trim()}>
          <Plus size={15} /> เพิ่ม
        </button>
      </form>

      <table className="data-table compact-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ประเภทงาน</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type.id}>
              <td>{type.sort || '-'}</td>
              <td>
                {editingId === type.id ? (
                  <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                ) : (
                  <b>{type.name}</b>
                )}
              </td>
              <td>
                <div className="action-row row-actions">
                  {editingId === type.id ? (
                    <>
                      <button className="btn small primary" disabled={busy === `save-${type.id}` || !editingName.trim()} onClick={() => saveType(type.id)}>บันทึก</button>
                      <button className="btn small" onClick={() => setEditingId(null)}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <button className="btn small" onClick={() => {
                        setEditingId(type.id);
                        setEditingName(type.name);
                      }}>แก้ไข</button>
                      <button className="btn small danger" disabled={busy === `delete-${type.id}`} onClick={() => removeType(type.id)}>
                        <Trash2 size={14} /> ลบ
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {types.length === 0 ? (
            <tr><td colSpan={3} className="empty-cell">ไม่พบประเภทงาน</td></tr>
          ) : null}
        </tbody>
      </table>
    </Modal>
  );
}

function CreateJobModal({ onClose, onSaved }) {
  const [types, setTypes] = useState([]);
  const [nextId, setNextId] = useState(null);
  const [form, setForm] = useState({ type: '', details: '', applicant: '', provider: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/it-services/types').then((d) => setTypes(d.types || [])).catch((err) => setError(err.message));
    api('/it-services/jobs/next-id').then((d) => setNextId(d.next_id)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/it-services/jobs', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'บันทึกงานไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`เปิดงาน IT${nextId ? ` #${nextId}` : ''}`} onClose={onClose}>
      <form className="service-form" onSubmit={submit}>
        {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}
        <label className="field">
          <span>ประเภทงาน <b>*</b></span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
            <option value="">เลือกประเภทงาน</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">
          <span>รายละเอียด <b>*</b></span>
          <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required />
        </label>
        <EmployeePicker
          label="ผู้ขอใช้บริการ"
          value={form.applicant}
          onChange={(v) => setForm({ ...form, applicant: v })}
        />
        <EmployeePicker
          label="ผู้รับผิดชอบ"
          scope="it"
          value={form.provider}
          onChange={(v) => setForm({ ...form, provider: v })}
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกเปิดงาน'}</button>
        </div>
      </form>
    </Modal>
  );
}

function JobActionModal({ job, actionMode, onClose, onChanged, onDeleted }) {
  const [ackNote, setAckNote] = useState(job.data_ack || '');
  const [co1, setCo1] = useState(job.coadjutor1 || '');
  const [co2, setCo2] = useState(job.coadjutor2 || '');
  const [overworkDetails, setOverworkDetails] = useState(job.overwork_details || '');
  const [closeForm, setCloseForm] = useState({ cause_job: job.cause_job === '-' ? '' : job.cause_job, details_job: job.details_job === '-' ? '' : job.details_job });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function run(action, request) {
    setBusy(action);
    setError('');
    try {
      const data = await request();
      onChanged(data.job);
    } catch (err) {
      setError(err.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  const titles = {
    ack: 'รับทราบงาน',
    overwork: 'งานข้ามวัน',
    close: 'ปิดงาน',
    reopen: 'เปิดงานกลับมาใหม่',
  };
  const showAck = !job.status && (!actionMode || actionMode === 'ack');
  const showOverwork = !job.status && (!actionMode || actionMode === 'overwork');
  const showClose = !job.status && (!actionMode || actionMode === 'close');
  const showReopen = job.status || actionMode === 'reopen';

  return (
    <Modal title={`${titles[actionMode] || 'จัดการงาน'} #${job.id}`} onClose={onClose}>
      <div className="job-detail-box">
        <b>{job.type}</b>
        <p>{job.details}</p>
        <small>ผู้ขอ: {job.applicant_name || job.service_applicant}</small>
        <small>ผู้รับผิดชอบ: {job.provider_name || job.service_provider}</small>
      </div>
      {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}

      {!job.status ? (
        <>
          {showAck ? <section className="modal-section">
            <h3><Clock size={16} /> รับทราบงาน</h3>
            <label className="field">
              <span>รายละเอียดการรับทราบ</span>
              <textarea value={ackNote} onChange={(e) => setAckNote(e.target.value)} />
            </label>
            <div className="two-col">
              <EmployeePicker label="ผู้ร่วมงาน 1" scope="it" value={co1} onChange={setCo1} optional />
              <EmployeePicker label="ผู้ร่วมงาน 2" scope="it" value={co2} onChange={setCo2} optional />
            </div>
            <div className="action-row">
              <button
                className="btn primary"
                disabled={busy === 'ack'}
                onClick={() => run('ack', () => api(`/it-services/jobs/${job.id}/acknowledge`, {
                  method: 'PATCH',
                  body: JSON.stringify({ data_ack: ackNote, coadjutor1: co1, coadjutor2: co2 }),
                }))}
              >
                <CheckCircle size={15} /> รับทราบ
              </button>
              {job.acknowledge ? (
                <button
                  className="btn"
                  disabled={busy === 'reset'}
                  onClick={() => run('reset', () => api(`/it-services/jobs/${job.id}/acknowledge/reset`, { method: 'PATCH' }))}
                >
                  ยกเลิกรับทราบ
                </button>
              ) : null}
            </div>
          </section> : null}

          {showOverwork ? <section className="modal-section">
            <h3>งานข้ามวัน</h3>
            <label className="field">
              <span>รายละเอียดงานข้ามวัน</span>
              <textarea value={overworkDetails} onChange={(e) => setOverworkDetails(e.target.value)} />
            </label>
            <button
              className="btn"
              disabled={busy === 'overwork'}
              onClick={() => run('overwork', () => api(`/it-services/jobs/${job.id}/overwork`, {
                method: 'PATCH',
                body: JSON.stringify({ overwork_details: overworkDetails }),
              }))}
            >
              {job.overwork ? 'ยกเลิกงานข้ามวัน' : 'บันทึกงานข้ามวัน'}
            </button>
          </section> : null}

          {showClose ? <section className="modal-section">
            <h3>ปิดงาน</h3>
            <label className="field">
              <span>สาเหตุ</span>
              <textarea value={closeForm.cause_job} onChange={(e) => setCloseForm({ ...closeForm, cause_job: e.target.value })} />
            </label>
            <label className="field">
              <span>รายละเอียดการแก้ไข</span>
              <textarea value={closeForm.details_job} onChange={(e) => setCloseForm({ ...closeForm, details_job: e.target.value })} />
            </label>
            <button
              className="btn primary"
              disabled={busy === 'close' || !closeForm.cause_job || !closeForm.details_job}
              onClick={() => run('close', () => api(`/it-services/jobs/${job.id}/close`, {
                method: 'PATCH',
                body: JSON.stringify(closeForm),
              }))}
            >
              ปิดงาน
            </button>
          </section> : null}
        </>
      ) : (
        showReopen ? <section className="modal-section">
          <h3>งานปิดแล้ว</h3>
          <p><b>สาเหตุ:</b> {job.cause_job || '-'}</p>
          <p><b>รายละเอียด:</b> {job.details_job || '-'}</p>
          <button
            className="btn"
            disabled={busy === 'reopen'}
            onClick={() => run('reopen', () => api(`/it-services/jobs/${job.id}/reopen`, { method: 'PATCH' }))}
          >
            เปิดงานกลับมาใหม่
          </button>
        </section> : null
      )}

      <div className="modal-actions between">
        <button
          className="btn danger"
          disabled={busy === 'delete'}
          onClick={async () => {
            if (!confirm(`ลบงาน #${job.id} ?`)) return;
            setBusy('delete');
            try {
              await api(`/it-services/jobs/${job.id}`, { method: 'DELETE' });
              onDeleted();
            } catch (err) {
              setError(err.message || 'ลบงานไม่สำเร็จ');
            } finally {
              setBusy('');
            }
          }}
        >
          <Trash2 size={15} /> ลบ
        </button>
        <button className="btn" onClick={onClose}>ปิด</button>
      </div>
    </Modal>
  );
}

function EmployeePicker({ label, value, onChange, scope = 'all', optional = false }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const listId = useMemo(() => `emp-${scope}-${label.replace(/\s+/g, '-')}`, [label, scope]);

  useEffect(() => {
    const handle = setTimeout(() => {
      api(`/it-services/employees?scope=${scope}&q=${encodeURIComponent(query)}`)
        .then((d) => setItems(d.employees || []))
        .catch(() => setItems([]));
    }, 180);
    return () => clearTimeout(handle);
  }, [query, scope]);

  const selected = items.find((e) => e.emp_id === value);

  return (
    <label className="field">
      <span>{label} {optional ? null : <b>*</b>}</span>
      <input
        list={listId}
        value={selected ? selected.label : query}
        onChange={(e) => {
          const text = e.target.value;
          setQuery(text);
          const hit = items.find((item) => item.label === text || item.emp_id === text);
          onChange(hit ? hit.emp_id : '');
        }}
        onBlur={(e) => {
          const hit = items.find((item) => item.label === e.target.value || item.emp_id === e.target.value);
          if (hit) onChange(hit.emp_id);
        }}
        required={!optional}
        placeholder="พิมพ์รหัสหรือชื่อพนักงาน"
      />
      <datalist id={listId}>
        {items.map((item) => <option key={item.emp_id} value={item.label} />)}
      </datalist>
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="service-modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
