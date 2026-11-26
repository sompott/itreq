import React, { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api.js';
import { navigate } from '../lib/useHashRoute.js';
import { Check, X, PenLine, Download, Clock, Eye, History, Users, Copy, Search } from 'lucide-react';
import { RequestDetail } from './MyRequests.jsx';

export default function ApprovalsPage({ subPath, user }) {
  if (subPath?.startsWith('/')) {
    const id = Number(subPath.replace('/', ''));
    if (id) return <ApproveDetail id={id} user={user} />;
  }
  return <ApprovalQueue user={user} />;
}

function ApprovalQueue({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedStepId, setCopiedStepId] = useState(null);
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState(isAdmin ? 'all' : 'pending');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    api('/requests/approval-activity').then((d) => {
      setItems(d.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const latestItems = Object.values(items.reduce((groups, item) => {
    const current = groups[item.id];
    if (!current) {
      groups[item.id] = item;
      return groups;
    }
    if (item.is_current && !current.is_current) groups[item.id] = item;
    else if (item.is_current === current.is_current) {
      const itemTime = item.signed_at ? new Date(item.signed_at).getTime() : 0;
      const currentTime = current.signed_at ? new Date(current.signed_at).getTime() : 0;
      if (itemTime > currentTime || (itemTime === currentTime && item.step_no > current.step_no)) groups[item.id] = item;
    }
    return groups;
  }, {}));
  const requestTypes = [...new Set(latestItems.map((item) => item.request_type_name).filter(Boolean))].sort();
  const pendingCount = latestItems.filter((item) => item.step_status === 'pending' && item.status !== 'returned').length;
  const historyCount = latestItems.filter((item) => ['approved', 'rejected'].includes(item.step_status)).length;
  const visibleItems = latestItems.filter((item) => {
    if (view === 'pending') return item.step_status === 'pending' && item.status !== 'returned';
    if (view === 'history') return ['approved', 'rejected'].includes(item.step_status);
    return true;
  }).filter((item) => {
    if (typeFilter !== 'all' && item.request_type_name !== typeFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter && item.step_status !== statusFilter) return false;
    const haystack = [item.request_no, item.title, item.requester_name, item.requester_emp_id, item.slot_label]
      .filter(Boolean).join(' ').toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  async function copyApprovalLink(item) {
    const url = new URL(window.location.href);
    url.hash = `#/approve/${item.id}`;
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      const input = document.createElement('textarea');
      input.value = url.toString();
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopiedStepId(item.approval_step_id);
    window.setTimeout(() => setCopiedStepId(null), 1800);
  }

  return (
    <div className="page approval-page">
      <div className="page-head">
        <h1>{isAdmin ? <Users size={22} /> : <Clock size={22} />} {isAdmin ? 'ติดตามการเซ็นเอกสาร' : 'เอกสารที่ต้องเซ็น'}</h1>
        <p>{isAdmin ? 'เห็นผู้เซ็นและสถานะทุกลำดับของเอกสาร' : 'รายการรอลงนามและประวัติที่ท่านเคยดำเนินการ'}</p>
      </div>

      <div className="approval-filters">
        <label className="approval-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขที่เอกสาร ผู้ขอ หรือหัวข้อ" /></label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="กรองประเภทฟอร์ม">
          <option value="all">ทุกประเภทฟอร์ม</option>
          {requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="กรองสถานะ">
          <option value="all">ทุกสถานะ</option>
          <option value="pending">รอลงนาม</option>
          <option value="returned">ตีกลับให้แก้ไข</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ปฏิเสธแล้ว</option>
        </select>
      </div>

      <div className="approval-view-tabs" role="tablist" aria-label="กรองรายการเซ็นเอกสาร">
        {isAdmin ? (
          <button className={view === 'all' ? 'selected' : ''} onClick={() => setView('all')}>
            <Users size={16} /> ทั้งหมด <span>{latestItems.length}</span>
          </button>
        ) : null}
        <button className={view === 'pending' ? 'selected' : ''} onClick={() => setView('pending')}>
          <Clock size={16} /> {isAdmin ? 'กำลังรอเซ็น' : 'รอฉันเซ็น'} <span>{pendingCount}</span>
        </button>
        <button className={view === 'history' ? 'selected' : ''} onClick={() => setView('history')}>
          <History size={16} /> {isAdmin ? 'ดำเนินการแล้ว' : 'ประวัติของฉัน'} <span>{historyCount}</span>
        </button>
      </div>

      <section className="card approval-queue-card">
        {loading ? <p>กำลังโหลด…</p> : (
          <div className="approval-table-wrap">
            <table className="data-table approval-activity-table">
              <thead>
                <tr>
                  <th>เอกสาร</th><th>ผู้ขอ</th><th>ลำดับการเซ็น</th><th>ผู้เซ็น</th>
                  <th>สถานะ</th><th>ดำเนินการเมื่อ</th><th></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((r) => (
                  <tr key={r.approval_step_id}>
                    <td data-label="เอกสาร">
                      <b>{r.request_no}</b>
                      <small className="table-subtext">{r.title}</small>
                    </td>
                    <td data-label="ผู้ขอ">
                      {r.requester_name || r.requester_emp_id}
                      <small className="table-subtext">{r.requester_department || r.requester_emp_id}</small>
                    </td>
                    <td data-label="ลำดับการเซ็น"><b>ขั้นที่ {r.step_no}</b><small className="table-subtext">{r.slot_label}</small></td>
                    <td data-label="ผู้เซ็น">
                      {r.approver_name || r.approver_emp_id}
                      <small className="table-subtext">{r.approver_department || r.approver_emp_id}</small>
                    </td>
                    <td data-label="สถานะ"><ApprovalStepPill item={r} /></td>
                    <td data-label="ดำเนินการเมื่อ">{r.signed_at ? new Date(r.signed_at).toLocaleString('th-TH') : '—'}</td>
                    <td className="approval-row-actions" data-label="จัดการ">
                      <button
                        className={`btn small ${r.is_current && r.approver_emp_id === user?.emp_id ? 'primary' : 'quiet'}`}
                        onClick={() => navigate(`/approve/${r.id}`)}
                      >
                        {r.is_current && r.approver_emp_id === user?.emp_id
                          ? <><PenLine size={14} /> เปิดเพื่อลงนาม</>
                          : <><Eye size={14} /> ดูรายละเอียด</>}
                      </button>
                      <button className="btn small quiet" onClick={() => copyApprovalLink(r)}>
                        {copiedStepId === r.approval_step_id
                          ? <><Check size={14} /> คัดลอกแล้ว</>
                          : <><Copy size={14} /> คัดลอกลิงก์</>}
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleItems.length === 0 ? (
                  <tr><td colSpan={7} className="approval-empty">
                    {view === 'history' ? 'ยังไม่มีประวัติการเซ็นเอกสาร' : 'ไม่มีเอกสารรอลงนาม'}
                  </td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ApprovalStepPill({ item }) {
  if (item.status === 'returned') return <span className="pill red">ตีกลับให้แก้ไข</span>;
  if (item.step_status === 'approved') return <span className="pill green">เซ็นอนุมัติแล้ว</span>;
  if (item.step_status === 'rejected') return <span className="pill red">ปฏิเสธแล้ว</span>;
  if (item.step_status === 'skipped') return <span className="pill grey">ยกเลิก/ข้าม</span>;
  if (item.is_current) return <span className="pill yellow">รอลงนาม</span>;
  return <span className="pill muted">รอตามลำดับ</span>;
}

function ApproveDetail({ id, user }) {
  const [data, setData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeStep, setActiveStep] = useState(null); // step object → modal open

  useEffect(() => { api(`/requests/${id}`).then(setData); }, [id, reloadKey]);

  if (!data) return <div className="page"><p>กำลังโหลด…</p></div>;
  const { request } = data;

  return (
    <>
      <RequestDetail
        key={reloadKey}
        id={id}
        backTo="/approve"
        user={user}
        onStepClick={(step) => setActiveStep(step)}
      />
      {activeStep ? (
        <SignApprovalModal
          request={request}
          step={activeStep}
          user={user}
          onClose={() => setActiveStep(null)}
          onDone={() => { setActiveStep(null); navigate('/approve'); }}
        />
      ) : null}
    </>
  );
}

export function SignApprovalModal({ request, step, user, onClose, onDone, itPhase = null }) {
  const isITSign = !!itPhase || (step.sign_stage && step.sign_stage !== 'approval');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hasSystemSignature = Boolean(user?.has_signature && user?.signature_url);
  // มีลายเซ็นในระบบ → default เป็น "ใช้ลายเซ็นเดิม"
  const [signature, setSignature] = useState(
    () => (hasSystemSignature ? { type: 'fetch', data: user.signature_url } : null),
  );
  const [mode, setMode] = useState(hasSystemSignature ? 'fetch' : 'draw');
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#17202a';
  }, [mode]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
    setSignature({ type: 'draw', data: canvasRef.current.toDataURL('image/png') });
  }

  function selectDraw() {
    setMode('draw');
    setSignature(null);
    setHasInk(false);
  }

  function useFetched() {
    if (!hasSystemSignature) return;
    setMode('fetch');
    setSignature({ type: 'fetch', data: user.signature_url });
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
    setHasInk(false);
  }

  async function approve() {
    if (!signature || (mode === 'draw' && !hasInk)) {
      alert('กรุณาวาดลายเซ็นก่อนกดอนุมัติ');
      return;
    }
    setSubmitting(true);
    try {
      await api(`/requests/${request.id}/${itPhase ? 'it-sign' : 'approve'}`, {
        method: 'POST',
        body: JSON.stringify({
          step_no: step.step_no,
          phase: itPhase || undefined,
          signature_type: signature.type,
          signature_data: signature.data,
          comment,
        }),
      });
      onDone();
    } catch (err) {
      const messages = {
        signature_blank: 'ไม่พบลายเส้นในภาพ กรุณาวาดลายเซ็นก่อนยืนยัน',
        it_signature_wrong_status: 'สถานะงานเปลี่ยนไปแล้ว กรุณาเปิดเอกสารใหม่',
        it_signature_already_signed: 'มีเจ้าหน้าที่ IT ลงนามช่องนี้แล้ว กรุณาเปิดเอกสารใหม่',
        it_signature_phase_disabled: 'ประเภทคำขอนี้ไม่ได้ใช้ขั้นตอนลงนามนี้ กรุณาเปิดเอกสารใหม่',
        step_not_ready_or_not_authorized: 'ยังไม่ถึงช่วงเซ็น หรือช่องนี้มีผู้ลงนามแล้ว กรุณาเปิดเอกสารใหม่',
        approvals_not_complete: 'ต้องให้ผู้อนุมัติเซ็นครบก่อน IT ลงนาม',
      };
      alert(messages[err.message] || `ผิดพลาด: ${err.message}`);
    } finally { setSubmitting(false); }
  }

  async function reject() {
    const note = (comment.trim() || '').length > 0
      ? comment.trim()
      : prompt('เหตุผลที่ปฏิเสธ (ส่งกลับผู้ขอ):', '');
    if (!note) {
      alert('กรุณาระบุเหตุผลการปฏิเสธ');
      return;
    }
    if (!confirm(`ยืนยันปฏิเสธคำขอนี้?\n\nเหตุผล: ${note}`)) return;
    setSubmitting(true);
    try {
      await api(`/requests/${request.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ step_no: step.step_no, comment: note }),
      });
      onDone();
    } catch (err) {
      alert(`ผิดพลาด: ${err.message}`);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="modal-backdrop sign-modal-backdrop" onClick={onClose}>
      <div className="modal-card sign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sign-modal-head">
          <h3><PenLine size={18} /> {isITSign ? step.slot_label : `ลงนามอนุมัติ — ขั้นที่ ${step.step_no} · ${step.slot_label}`}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด" disabled={submitting}>
            <X size={16} />
          </button>
        </div>

        <div className="sign-modal-summary">
          <div><span>เลขที่</span><b>{request.request_no}</b></div>
          <div><span>หัวข้อ</span><b>{request.title}</b></div>
          <div><span>ผู้ขอ</span><b>{request.requester?.name}</b></div>
        </div>

        {!hasSystemSignature ? (
          <div className="approval-signature-warning" role="alert">
            ไม่พบลายเซ็นเดิมในระบบ กรุณาวาดลายเซ็นในช่องด้านล่างก่อนกดอนุมัติ
          </div>
        ) : null}

        <div className="signature-tabs">
          <button className={mode === 'draw' ? 'selected' : ''} type="button" onClick={selectDraw}>
            <PenLine size={17} /> วาดลายเซ็น
          </button>
          {hasSystemSignature ? (
            <button className={mode === 'fetch' ? 'selected' : ''} type="button" onClick={useFetched}>
              <Download size={17} /> ใช้ลายเซ็นเดิม
            </button>
          ) : null}
        </div>

        {mode === 'draw' ? (
          <>
            <canvas
              className="signature-pad"
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={() => { drawing.current = false; }}
              onMouseLeave={() => { drawing.current = false; }}
              onTouchStart={startDraw}
              onTouchMove={moveDraw}
              onTouchEnd={() => { drawing.current = false; }}
            />
            <button className="btn small quiet" type="button" onClick={clearCanvas}>ล้าง</button>
          </>
        ) : (
          <div className="signature-fetch">
            <img src={signature?.data} alt="ลายเซ็น" style={{ maxHeight: 80 }} />
          </div>
        )}

        <label className="field" style={{ marginTop: 8 }}>
          <span>{isITSign ? 'หมายเหตุ' : 'หมายเหตุ (ถ้าปฏิเสธ ต้องระบุเหตุผล)'}</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                    placeholder="เช่น ขอเพิ่มข้อมูลในส่วน ..." />
        </label>

        <div className="modal-actions">
          {!isITSign ? <button className="btn small danger" onClick={reject} disabled={submitting}>
            <X size={14} /> ปฏิเสธ
          </button> : null}
          <button className="btn small primary" onClick={approve} disabled={submitting || !signature || (mode === 'draw' && !hasInk)}>
            <Check size={14} /> {submitting ? 'กำลังบันทึก…' : isITSign ? 'ยืนยันลงนาม' : 'อนุมัติ'}
          </button>
        </div>
      </div>
    </div>
  );
}
