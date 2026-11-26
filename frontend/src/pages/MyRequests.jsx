import React, { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api.js';
import { navigate } from '../lib/useHashRoute.js';
import { downloadBlob } from '../lib/docxFill.js';
import {
  OTHER_LABEL, OTHER_OPTION, hasIncompleteOther, isOtherValue, makeOtherValue,
  otherDetail, parseMultiValue, serializeMultiValue,
} from '../lib/formOptions.js';
import { ChevronLeft, FileText, Check, X, Clock, Download, Ban, Trash2, Pencil, Send, RotateCcw } from 'lucide-react';

const STATUS_TEXT = {
  draft: 'ฉบับร่าง',
  pending: 'รออนุมัติ',
  returned: 'ตีกลับให้แก้ไข',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
  in_progress: 'IT กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  closed: 'ปิดงาน',
  cancelled: 'ยกเลิก',
};
const STATUS_COLOR = {
  draft: 'grey', pending: 'yellow', returned: 'red', approved: 'blue', rejected: 'red',
  in_progress: 'blue', completed: 'green', closed: 'green', cancelled: 'grey',
};

export default function MyRequestsPage({ subPath, user }) {
  if (subPath?.startsWith('/')) {
    const id = Number(subPath.replace('/', ''));
    if (id) return <RequestDetail id={id} backTo="/my" user={user} />;
  }
  return <MyRequestsList />;
}

function MyRequestsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/requests?mine=1').then((d) => { setItems(d.requests || []); setLoading(false); });
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h1><FileText size={22} /> คำขอของฉัน</h1>
        <button className="btn primary" onClick={() => navigate('/')}>+ สร้างคำขอใหม่</button>
      </div>
      <section className="card">
        {loading ? <p>กำลังโหลด…</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>หัวข้อ</th>
                <th>ประเภท</th>
                <th>เร่งด่วน</th>
                <th>สถานะ</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/my/${r.id}`)} style={{ cursor: 'pointer' }}>
                  <td><b>{r.request_no}</b></td>
                  <td>{r.title}</td>
                  <td>{r.request_type_name}</td>
                  <td><UrgencyPill v={r.urgency} /></td>
                  <td><StatusPill v={r.status} /></td>
                  <td>{new Date(r.created_at).toLocaleString('th-TH')}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>ยังไม่มีคำขอ</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function RequestDetail({ id, backTo = '/my', user, headerExtras = null, hideHeader = false, onStepClick = null, onITSignClick = null }) {
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    api(`/requests/${id}`).then(setData);
  }, [id]);

  async function cancelRequest() {
    const note = prompt('เหตุผลที่ยกเลิก (ไม่บังคับ):', '');
    if (note === null) return;
    if (!confirm('ยืนยันยกเลิกคำขอนี้?')) return;
    setCancelling(true);
    try {
      const result = await api(`/requests/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ note: note || null }),
      });
      setData((d) => ({ ...d, request: result.request }));
    } catch (err) {
      alert(`ยกเลิกไม่สำเร็จ: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  }

  async function downloadWord() {
    if (!data?.request) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/requests/${id}/word?downloaded_at=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'template_not_found') {
          alert('ประเภทคำขอนี้ยังไม่มี template — แจ้ง Admin ให้อัปโหลดก่อน');
          return;
        }
        if (body.details?.length) {
          const lines = body.details.map((d, i) => `  ${i + 1}. [${d.tag}] ${d.message}`).join('\n');
          throw new Error(`Template มี ${body.details.length} ข้อผิดพลาด:\n${lines}`);
        }
        throw new Error(body.error || `download failed (${res.status})`);
      }
      const blob = await res.blob();
      downloadBlob(blob, `${data.request.request_no}.docx`);
    } catch (err) {
      alert(`สร้างไฟล์ไม่ได้: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  async function deleteRequest() {
    if (!confirm('ยืนยันลบคำขอนี้ถาวร?')) return;
    setDeleting(true);
    try {
      await api(`/requests/${id}`, { method: 'DELETE' });
      navigate(backTo);
    } catch (err) {
      alert(`ลบไม่สำเร็จ: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  async function resubmitRequest() {
    if (!confirm('ยืนยันส่งคำขอฉบับแก้ไขกลับเข้าสู่การอนุมัติ?')) return;
    setResubmitting(true);
    try {
      const result = await api(`/requests/${id}/resubmit`, { method: 'POST' });
      setData((current) => ({ ...current, request: result.request }));
      if (nextApprovalBelongsToUser(result.request, user)) navigate(`/approve/${id}`);
    } catch (error) {
      alert(`ส่งกลับอนุมัติไม่สำเร็จ: ${error.message}`);
    } finally {
      setResubmitting(false);
    }
  }

  async function returnForRevision() {
    const note = prompt('ระบุข้อมูลที่ต้องการให้ผู้ใช้งานแก้ไข:', '');
    if (note === null) return;
    if (!note.trim()) {
      alert('กรุณาระบุข้อมูลที่ต้องการให้ผู้ใช้งานแก้ไข');
      return;
    }
    if (!confirm(`ยืนยันตีกลับคำขอให้ผู้ใช้งานแก้ไข?\n\nรายละเอียด: ${note.trim()}`)) return;
    setReturning(true);
    try {
      const result = await api(`/requests/${id}/return-for-revision`, {
        method: 'POST',
        body: JSON.stringify({ comment: note.trim() }),
      });
      setData((current) => ({ ...current, request: result.request }));
    } catch (error) {
      alert(`ตีกลับไม่สำเร็จ: ${error.message}`);
    } finally {
      setReturning(false);
    }
  }

  if (!data) return <div className="page"><p>กำลังโหลด…</p></div>;
  const { request, attachments, logs } = data;
  const canCancel = !!user
    && user.emp_id === request.requester_emp_id
    && ['draft', 'pending', 'returned'].includes(request.status);
  const canDelete = user?.role === 'admin';
  const isOwner = user?.emp_id === request.requester_emp_id;
  const inlineRevision = isOwner && request.status === 'returned';
  const canEdit = (isOwner && ['draft', 'returned'].includes(request.status))
    || (user?.role === 'admin' && !['cancelled', 'closed'].includes(request.status));
  const canReturnForRevision = ['admin', 'it_staff'].includes(user?.role)
    && ['pending', 'approved', 'in_progress', 'completed'].includes(request.status);
  const canResubmit = request.status === 'returned' && (isOwner || user?.role === 'admin');
  const latestReturn = [...(logs || [])].reverse().find((log) => log.action === 'return_for_revision');
  const requestTypeName = request.request_type?.name || request.request_type_name || '';
  const hasDistinctTitle = Boolean(request.title && request.title !== requestTypeName);
  const fieldEntries = request.field_entries || [];
  const imageAttachments = (attachments || []).filter(isPreviewableImage);
  const otherAttachments = (attachments || []).filter((attachment) => !isPreviewableImage(attachment));
  const normalizedDetail = String(request.detail || '').trim();
  const detailComesFromForm = Boolean(normalizedDetail && fieldEntries.some((field) =>
    field.field_type === 'textarea' && String(field.value || '').trim() === normalizedDetail));

  return (
    <div className="page document-page">
      {hideHeader ? null : (
        <div className="page-head">
          <button className="btn small quiet" onClick={() => navigate(backTo)}><ChevronLeft size={16} /> กลับ</button>
          <h1>{request.request_no}</h1>
          <StatusPill v={request.status} />
          <div className="document-page-actions">
            {headerExtras}
            {canEdit && !inlineRevision ? (
              <button className="btn small" onClick={() => setEditing(true)}>
                <Pencil size={14} /> แก้ไขข้อมูล
              </button>
            ) : null}
            {canReturnForRevision ? (
              <button className="btn small warning" onClick={returnForRevision} disabled={returning}>
                <RotateCcw size={14} /> {returning ? 'กำลังตีกลับ…' : 'ตีกลับให้ผู้ใช้แก้'}
              </button>
            ) : null}
            {canResubmit && !inlineRevision ? (
              <button className="btn small primary" onClick={resubmitRequest} disabled={resubmitting}>
                <Send size={14} /> {resubmitting ? 'กำลังส่ง…' : 'ส่งกลับอนุมัติ'}
              </button>
            ) : null}
            <button className="btn small" onClick={downloadWord} disabled={downloading}>
              <Download size={14} /> {downloading ? 'กำลังสร้าง…' : 'ดาวน์โหลด Word'}
            </button>
            {canCancel ? (
              <button className="btn small danger" onClick={cancelRequest} disabled={cancelling}>
                <Ban size={14} /> {cancelling ? 'กำลังยกเลิก…' : 'ยกเลิกคำขอ'}
              </button>
            ) : null}
            {canDelete ? (
              <button className="btn small danger" onClick={deleteRequest} disabled={deleting}>
                <Trash2 size={14} /> {deleting ? 'กำลังลบ…' : 'ลบรายการ'}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {request.status === 'returned' ? (
        <section className="revision-notice" role="alert">
          <b>เอกสารถูกตีกลับให้แก้ไข</b>
          <span>{latestReturn?.note || 'กรุณาตรวจสอบและแก้ไขข้อมูลก่อนส่งกลับอนุมัติ'}</span>
        </section>
      ) : null}

      <section className="sheet request-document">
        <header className="doc-head">
          <div className="seal">IT</div>
          <div>
            <div className="org">แผนกเทคโนโลยีสารสนเทศ</div>
            <h1>ใบคำขอใช้งาน IT</h1>
          </div>
          <div className="doc-meta">
            <div>เลขที่ <b>{request.request_no}</b></div>
            <div>สถานะ <StatusPill v={request.status} /></div>
            <div>วันที่ <b>{new Date(request.created_at).toLocaleString('th-TH')}</b></div>
          </div>
        </header>

        <div className="requester-strip">
          <ReadLine label="ชื่อผู้ขอ" value={request.requester?.name || request.requester_emp_id} />
          <ReadLine label="แผนก" value={request.requester?.department || '-'} />
        </div>

        {inlineRevision ? (
          <ReturnedRequestEditor
            request={request}
            user={user}
            onSubmitted={(updated) => {
              setData((current) => ({ ...current, request: updated }));
              if (nextApprovalBelongsToUser(updated, user)) navigate(`/approve/${id}`);
            }}
          />
        ) : (
          <section className="document-section">
            <h2>ข้อมูลคำขอ</h2>
            <div className="document-grid">
              <ReadLine label="ประเภท" value={requestTypeName} block={!hasDistinctTitle} />
              {hasDistinctTitle ? <ReadLine label="หัวข้อ" value={request.title} /> : null}
              {!detailComesFromForm ? <ReadLine label="รายละเอียด" value={request.detail} block /> : null}
              {fieldEntries
                .filter((f) => !['title', 'detail'].includes(f.field_name))
                .map((f) => (
                  <FieldReadout key={f.field_name} field={f} />
                ))}
            </div>
          </section>
        )}

        {imageAttachments.length ? (
          <section className="document-section document-image-section">
            <div className="document-image-head">
              <h2>ภาพประกอบ</h2>
              <span>{imageAttachments.length} ภาพ · คลิกเพื่อดูขนาดเต็ม</span>
            </div>
            <div className="request-image-grid">
              {imageAttachments.map((attachment) => (
                <a
                  key={attachment.id}
                  className="request-image-preview"
                  href={`${API_BASE}/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="คลิกเพื่อเปิดภาพขนาดเต็ม"
                >
                  <img
                    src={`${API_BASE}/attachments/${attachment.id}`}
                    alt={attachment.file_name}
                    loading="lazy"
                  />
                  <span>
                    <b>{attachment.file_name}</b>
                    <small>{formatFileSize(attachment.file_size)}</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="document-section">
          <h2>ลายเซ็นอนุมัติ</h2>
          <div className="document-sign-grid">
            {request.approval_steps?.map((step, idx) => {
              const blockingStep = request.approval_steps
                .slice(0, idx)
                .find((s) => s.status === 'pending' && s.sign_stage === step.sign_stage);
              const earlierPending = Boolean(blockingStep);
              const stageReady = request.status === ({ approval: 'pending', acceptance: 'approved', completion: 'completed' }[step.sign_stage || 'approval']);
              const isMineAndPending = user?.emp_id
                && step.status === 'pending'
                && (step.approver_emp_id === user.emp_id || (step.signer_mode === 'it_staff' && !step.approver_emp_id && ['admin', 'it_staff'].includes(user.role)));
              const isMyTurn = isMineAndPending && !earlierPending && stageReady;
              const isMineLocked = isMineAndPending && (earlierPending || !stageReady);
              const handleStepClick = isMyTurn
                ? (onStepClick ? () => onStepClick(step) : () => navigate(`/approve/${request.id}`))
                : undefined;
              return (
                <SignatureBox key={step.id} step={step}
                              clickable={isMyTurn}
                              locked={isMineLocked}
                              lockedLabel={blockingStep ? `รอขั้น ${blockingStep.step_no} ลงนามก่อน` : 'ยังไม่ถึงช่วงลงนาม'}
                              onClick={handleStepClick} />
              );
            })}
          </div>
        </section>
        {(!(request.approval_steps || []).some((step) => step.sign_stage !== 'approval')
          && (request.request_type?.it_acceptance_required || request.request_type?.it_completion_required)
          || request.it_signatures?.length) ? <section className="document-section">
          <h2>ลายเซ็น IT</h2>
          <div className="document-sign-grid">
            {[
              { phase: 'acceptance', label: 'IT ลงนามรับงาน', status: 'approved' },
              { phase: 'completion', label: 'IT ลงนามยืนยันงานเสร็จ', status: 'completed' },
            ].filter(({ phase }) => request.request_type?.[`it_${phase}_required`]
              || request.it_signatures?.some((item) => item.phase === phase)).map(({ phase, label, status }) => {
              const signature = request.it_signatures?.find((item) => item.phase === phase);
              const canSign = !!onITSignClick
                && ['it_staff', 'admin'].includes(user?.role)
                && !!request.request_type?.[`it_${phase}_required`]
                && request.status === status && !signature
                && (request.approval_steps || []).every((step) => ['approved', 'skipped'].includes(step.status));
              return <SignatureBox key={phase}
                step={signature ? { ...signature, slot_label: label } : { status: 'pending', slot_label: label, pending_label: 'รอลงนาม IT' }}
                clickable={canSign}
                onClick={canSign ? () => onITSignClick(phase) : undefined} />;
            })}
          </div>
        </section> : null}
      </section>

      {otherAttachments.length ? (
        <section className="card request-attachment-card">
          <div className="request-attachment-head">
            <div>
              <h2>ไฟล์แนบ</h2>
              <p>เอกสารและไฟล์อื่นที่แนบมากับคำขอ</p>
            </div>
            <span>{otherAttachments.length} ไฟล์</span>
          </div>
          <ul className="attachment-list request-document-files">
            {otherAttachments.map((a) => (
              <li key={a.id}>
                <a href={`${API_BASE}/attachments/${a.id}`} target="_blank" rel="noreferrer">
                  📎 {a.file_name}
                </a>
                <small>{formatFileSize(a.file_size)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {logs?.length ? (
        <section className="card">
          <h2>ประวัติ</h2>
          <ul className="log-list">
            {logs.map((l) => (
              <li key={l.id}>
                <time>{new Date(l.created_at).toLocaleString('th-TH')}</time>
                <span>{l.action}</span>
                <small>{formatActor(l)} {l.note ? `· ${l.note}` : ''}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {editing ? (
        <RequestEditModal
          request={request}
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setData((current) => ({ ...current, request: updated }));
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}

function isPreviewableImage(attachment) {
  const mime = String(attachment?.mime_type || '').toLowerCase();
  if (/^image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml)$/.test(mime)) return true;
  return /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(String(attachment?.file_name || ''));
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function nextApprovalBelongsToUser(request, user) {
  const nextStep = (request.approval_steps || [])
    .filter((item) => item.sign_stage === 'approval' && item.status === 'pending')
    .sort((a, b) => a.step_no - b.step_no)[0];
  return Boolean(nextStep && (
    nextStep.approver_emp_id === user?.emp_id
    || (nextStep.signer_mode === 'it_staff' && !nextStep.approver_emp_id
      && ['admin', 'it_staff'].includes(user?.role))
  ));
}

function validateEditedValues(fields, values) {
  const missing = fields.find((field) => {
    if (!field.is_required) return false;
    if (field.field_type === 'checkbox') return parseMultiValue(values[field.field_name]).length === 0;
    return !String(values[field.field_name] ?? '').trim();
  });
  if (missing) return `กรุณากรอก ${missing.field_label}`;
  const incompleteOther = fields.find((field) =>
    field.validation?.allow_other
    && hasIncompleteOther(values[field.field_name], field.field_type === 'checkbox'));
  if (incompleteOther) return `กรุณาระบุรายละเอียด “อื่น ๆ” ในช่อง ${incompleteOther.field_label}`;
  return '';
}

function ReturnedRequestEditor({ request, user, onSubmitted }) {
  const fields = (request.field_entries || []).filter((field) =>
    field.validation?.fill_stage !== 'it_after_approval');
  const [values, setValues] = useState(() => Object.fromEntries(
    fields.map((field) => [field.field_name, field.value ?? ''])));
  const [submitting, setSubmitting] = useState(false);
  const submitLock = React.useRef(false);
  const setField = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  async function saveAndResubmit() {
    if (submitLock.current) return;
    const validationError = validateEditedValues(fields, values);
    if (validationError) {
      alert(validationError);
      return;
    }
    if (!confirm('ยืนยันบันทึกข้อมูลและส่งกลับเข้าสู่ขั้นตอนอนุมัติ?')) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await api(`/requests/${request.id}/form-values`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      const result = await api(`/requests/${request.id}/resubmit`, { method: 'POST' });
      onSubmitted(result.request);
    } catch (error) {
      submitLock.current = false;
      alert(`บันทึกและส่งกลับอนุมัติไม่สำเร็จ: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="document-section returned-inline-editor" aria-labelledby="revision-edit-title">
      <div className="returned-inline-head">
        <div>
          <h2 id="revision-edit-title"><Pencil size={17} /> แก้ไขข้อมูลคำขอ</h2>
          <p>ปรับข้อมูลตามเหตุผลที่ IT ตีกลับ แล้วส่งเข้าสู่การอนุมัติอีกครั้ง</p>
        </div>
        <span>กำลังแก้ไข</span>
      </div>
      <div className="request-edit-fields inline">
        {fields.map((field) => (
          <EditableRequestField
            key={field.field_name}
            field={field}
            value={values[field.field_name]}
            onChange={(value) => setField(field.field_name, value)}
          />
        ))}
      </div>
      <div className="returned-inline-actions">
        <span>ข้อมูลจะถูกบันทึก และระบบจะเริ่มลำดับอนุมัติใหม่หลังจากส่ง</span>
        <button className="btn primary big" onClick={saveAndResubmit} disabled={submitting}>
          <Send size={17} /> {submitting ? 'กำลังส่ง…' : 'ส่งกลับอนุมัติ'}
        </button>
      </div>
    </section>
  );
}

function RequestEditModal({ request, user, onClose, onSaved }) {
  const isAdmin = user?.role === 'admin';
  const fields = (request.field_entries || []).filter((field) =>
    isAdmin || field.validation?.fill_stage !== 'it_after_approval');
  const [values, setValues] = useState(() => Object.fromEntries(
    fields.map((field) => [field.field_name, field.value ?? ''])));
  const [saving, setSaving] = useState(false);
  const setField = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  async function save() {
    const validationError = validateEditedValues(fields, values);
    if (validationError) {
      alert(validationError);
      return;
    }
    setSaving(true);
    try {
      const result = await api(`/requests/${request.id}/form-values`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      onSaved(result.request);
    } catch (error) {
      alert(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card request-edit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="sign-modal-head">
          <div><h3><Pencil size={18} /> แก้ไขข้อมูลคำขอ</h3><small>{request.request_no}</small></div>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด" disabled={saving}><X size={16} /></button>
        </div>
        <div className="request-edit-fields">
          {fields.map((field) => (
            <EditableRequestField
              key={field.field_name}
              field={field}
              value={values[field.field_name]}
              onChange={(value) => setField(field.field_name, value)}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn small quiet" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn small primary" onClick={save} disabled={saving}>
            <Check size={14} /> {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditableRequestField({ field, value, onChange }) {
  const allowOther = !!field.validation?.allow_other;
  if (field.field_type === 'checkbox') {
    const selected = parseMultiValue(value);
    const selectedOther = selected.find(isOtherValue);
    const update = (items) => onChange(serializeMultiValue(items));
    return (
      <fieldset className="field edit-choice-field">
        <legend>{field.field_label}{field.is_required ? <b>*</b> : null}</legend>
        <div className="checkbox-list">
          {(field.options || []).map((option) => (
            <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => update(
              event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /> {option}</label>
          ))}
          {allowOther ? <label><input type="checkbox" checked={!!selectedOther} onChange={(event) => update(
            event.target.checked ? [...selected, makeOtherValue()] : selected.filter((item) => !isOtherValue(item)))} /> {OTHER_LABEL}</label> : null}
        </div>
        {selectedOther ? <input value={otherDetail(selectedOther)} placeholder="โปรดระบุรายละเอียดอื่น ๆ" onChange={(event) => update(
          selected.map((item) => isOtherValue(item) ? makeOtherValue(event.target.value) : item))} /> : null}
      </fieldset>
    );
  }
  if (field.field_type === 'radio') {
    const selected = isOtherValue(value) ? OTHER_OPTION : String(value || '');
    return (
      <fieldset className="field edit-choice-field">
        <legend>{field.field_label}{field.is_required ? <b>*</b> : null}</legend>
        <div className="checkbox-list">
          {(field.options || []).map((option) => <label key={option}><input type="radio" name={`edit-${field.field_name}`} checked={selected === option} onChange={() => onChange(option)} /> {option}</label>)}
          {allowOther ? <label><input type="radio" name={`edit-${field.field_name}`} checked={selected === OTHER_OPTION} onChange={() => onChange(makeOtherValue())} /> {OTHER_LABEL}</label> : null}
        </div>
        {selected === OTHER_OPTION ? <input value={otherDetail(value)} placeholder="โปรดระบุรายละเอียดอื่น ๆ" onChange={(event) => onChange(makeOtherValue(event.target.value))} /> : null}
      </fieldset>
    );
  }
  if (field.field_type === 'dropdown') {
    const selected = isOtherValue(value) ? OTHER_OPTION : String(value || '');
    return <label className="field"><span>{field.field_label}{field.is_required ? <b>*</b> : null}</span><select value={selected} onChange={(event) => onChange(event.target.value === OTHER_OPTION ? makeOtherValue() : event.target.value)}>
      <option value="">-- เลือก --</option>
      {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
      {allowOther ? <option value={OTHER_OPTION}>{OTHER_LABEL}</option> : null}
    </select>{selected === OTHER_OPTION ? <input value={otherDetail(value)} placeholder="โปรดระบุรายละเอียดอื่น ๆ" onChange={(event) => onChange(makeOtherValue(event.target.value))} /> : null}</label>;
  }
  if (field.field_type === 'textarea') {
    return <label className="field"><span>{field.field_label}{field.is_required ? <b>*</b> : null}</span><textarea rows={4} value={value || ''} placeholder={field.placeholder || ''} onChange={(event) => onChange(event.target.value)} /></label>;
  }
  return <label className="field"><span>{field.field_label}{field.is_required ? <b>*</b> : null}</span><input type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : 'text'} value={value || ''} placeholder={field.placeholder || ''} onChange={(event) => onChange(event.target.value)} /></label>;
}

function formatActor(log) {
  if (log.actor?.name) return `${log.actor.name} (${log.actor_emp_id})`;
  return log.actor_emp_id || '-';
}

function SignatureBox({ step, clickable, locked, lockedLabel, onClick }) {
  const src = step.status === 'approved'
    ? (step.signature_url || step.signature_data || step.approver?.signature_url || null)
    : null;
  const className = [
    'document-sign-box',
    `step-${step.status}`,
    clickable && 'clickable',
    locked && 'locked-mine',
  ].filter(Boolean).join(' ');
  const inner = (
    <>
      <div className="document-sign-title">
        <span>{step.step_no ? `${step.step_no}. ` : ''}{step.slot_label}</span>
        <StatusPill v={step.status} />
      </div>
      {step.sign_stage && step.sign_stage !== 'approval' ? <small>{step.sign_stage === 'acceptance' ? 'หลังอนุมัติ ก่อนเริ่มงาน' : 'งานเสร็จ ก่อนปิดงาน'}</small> : null}
      <div className="document-sign-image">
        {src ? <img src={src} alt="ลายเซ็น" /> : <span>{step.status === 'approved' ? 'ไม่มีลายเซ็น' : step.pending_label || (step.sign_stage && step.sign_stage !== 'approval' ? 'รอลงนาม' : 'รออนุมัติ')}</span>}
      </div>
      <b>{step.approver?.name || step.approver_emp_id || (step.signer_mode === 'it_staff' ? 'เจ้าหน้าที่ IT ที่รับงาน' : '-')}</b>
      <small>{step.signed_at ? new Date(step.signed_at).toLocaleString('th-TH') : step.pending_label || (step.sign_stage && step.sign_stage !== 'approval' ? 'รอลงนาม' : 'รออนุมัติ')}</small>
      {step.comment ? <small>หมายเหตุ: {step.comment}</small> : null}
      {clickable ? <span className="sign-box-cta">✏️ คลิกเพื่อลงนาม</span> : null}
      {locked ? <span className="sign-box-cta locked">🔒 {lockedLabel || 'ยังไม่ถึงช่วงลงนาม'}</span> : null}
    </>
  );
  if (clickable) {
    return <button type="button" className={className} onClick={onClick}>{inner}</button>;
  }
  return <div className={className}>{inner}</div>;
}

export function formatFieldValue(raw, type) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (type === 'checkbox') {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch {}
  }
  if (type === 'date') {
    const d = new Date(raw);
    if (!isNaN(d)) return d.toLocaleDateString('th-TH', { dateStyle: 'medium' });
  }
  if (type === 'file' || type === 'signature') return '(แนบไฟล์/ลายเซ็น)';
  return String(raw);
}

function FieldReadout({ field }) {
  const label = field.field_label || field.field_name;
  if (!['checkbox', 'radio'].includes(field.field_type)) {
    return (
      <ReadLine
        label={label}
        value={formatFieldValue(field.value, field.field_type)}
        block={field.field_type === 'textarea'}
      />
    );
  }

  const selected = field.field_type === 'checkbox'
    ? parseMultiValue(field.value)
    : [String(field.value || '')].filter(Boolean);
  const configuredOptions = Array.isArray(field.options) ? field.options.map(String) : [];
  const selectedRegular = selected.filter((value) => !isOtherValue(value));
  const options = [...configuredOptions];
  for (const value of selectedRegular) {
    if (!options.includes(value)) options.push(value);
  }
  const other = selected.find(isOtherValue);

  // Old records may not have option metadata. Keep their selected value visible.
  if (!options.length && !other) {
    return <ReadLine label={label} value={formatFieldValue(field.value, field.field_type)} />;
  }

  const multiple = field.field_type === 'checkbox';
  return (
    <div className="read-line block choice-readout">
      <span>{label}</span>
      <div className="choice-readout-options" role="group" aria-label={label}>
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <span
              key={option}
              className={`choice-readout-option ${checked ? 'selected' : ''}`}
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={checked}
            >
              <span className={`choice-readout-mark ${multiple ? 'checkbox' : 'radio'}`} aria-hidden="true" />
              {option}
            </span>
          );
        })}
        {other ? (
          <span className="choice-readout-option selected" role={multiple ? 'checkbox' : 'radio'} aria-checked="true">
            <span className={`choice-readout-mark ${multiple ? 'checkbox' : 'radio'}`} aria-hidden="true" />
            {other}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ReadLine({ label, value, block }) {
  return (
    <div className={`read-line ${block ? 'block' : ''}`}>
      <span>{label}</span>
      <b>{value || '-'}</b>
    </div>
  );
}

export function StatusPill({ v }) {
  return <span className={`pill ${STATUS_COLOR[v] || 'grey'}`}>{STATUS_TEXT[v] || v}</span>;
}
export function UrgencyPill({ v }) {
  const map = { low: 'grey', normal: 'blue', high: 'yellow', urgent: 'red' };
  return <span className={`pill ${map[v] || 'grey'}`}>{v}</span>;
}
