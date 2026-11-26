import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fileToBase64 } from '../lib/fileBase64.js';
import {
  OTHER_LABEL, OTHER_OPTION, hasIncompleteOther, isOtherValue,
  makeOtherValue, otherDetail, parseMultiValue, serializeMultiValue,
} from '../lib/formOptions.js';
import { navigate } from '../lib/useHashRoute.js';
import { ChevronLeft, Wrench, Play, CheckCircle, Lock, X, Image as ImageIcon, Trash2, Save } from 'lucide-react';
import { StatusPill, UrgencyPill, RequestDetail } from './MyRequests.jsx';
import { SignApprovalModal } from './Approvals.jsx';

const STATUS_LABEL = {
  in_progress: 'รับงาน / เริ่มดำเนินการ',
  completed: 'เสร็จสิ้น',
  closed: 'ปิดงาน',
};

export default function ITQueuePage({ subPath, user }) {
  if (subPath?.startsWith('/')) {
    const id = Number(subPath.replace('/', ''));
    if (id) return <ITDetail id={id} user={user} />;
  }
  return <Queue />;
}

function Queue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/requests/it-queue').then((d) => { setItems(d.items || []); setLoading(false); });
  }, []);
  return (
    <div className="page">
      <div className="page-head">
        <h1><Wrench size={22} /> งาน IT</h1>
        <p>{items.length} คำขอรอดำเนินการ / กำลังทำ</p>
      </div>
      <section className="card">
        {loading ? <p>กำลังโหลด…</p> : (
          <table className="data-table">
            <thead>
              <tr><th>เลขที่</th><th>หัวข้อ</th><th>ประเภท</th><th>เร่งด่วน</th><th>สถานะ</th><th>ผู้ขอ</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.request_no}</b></td>
                  <td>{r.title}</td>
                  <td>{r.request_type_name}</td>
                  <td><UrgencyPill v={r.urgency} /></td>
                  <td><StatusPill v={r.status} /></td>
                  <td>{r.requester_emp_id}</td>
                  <td>
                    <button className="btn small primary" onClick={() => navigate(`/staff/${r.id}`)}>
                      เปิดงาน
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>ไม่มีงานในคิว</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function ITDetail({ id, user }) {
  const [request, setRequest] = useState(null);
  const [signPhase, setSignPhase] = useState(null);
  const [activeStep, setActiveStep] = useState(null);
  const [status, setLocalStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalTarget, setModalTarget] = useState(null); // 'in_progress' | 'completed' | 'closed' | null

  useEffect(() => {
    api(`/requests/${id}`).then((d) => {
      setRequest(d.request);
      setLocalStatus(d?.request?.status || null);
    });
  }, [id, reloadKey]);

  async function applyStatus(next, note, images = []) {
    setBusy(true);
    try {
      await api(`/requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, note }),
      });
      for (const img of images) {
        try {
          await api(`/requests/${id}/attachments`, {
            method: 'POST',
            body: JSON.stringify({
              file_name: img.file_name,
              mime_type: img.mime_type,
              data_base64: img.data_base64,
              kind: 'completion',
            }),
          });
        } catch (err) {
          console.warn('upload completion image failed:', err);
        }
      }
      setModalTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert(err.message);
    } finally { setBusy(false); }
  }

  const can = (target) => {
    const signed = (phase) => request?.it_signatures?.some((item) => item.phase === phase);
    const stageSteps = (phase) => (request?.approval_steps || []).filter((step) => step.sign_stage === phase);
    const hasStages = request?.approval_steps?.some((step) => step.sign_stage !== 'approval');
    const stageComplete = (phase) => hasStages
      ? stageSteps(phase).every((step) => ['approved', 'skipped'].includes(step.status))
      : !request?.request_type?.[`it_${phase}_required`] || signed(phase);
    if (target === 'in_progress') return status === 'approved'
      && stageComplete('acceptance');
    if (target === 'completed') return status === 'in_progress';
    if (target === 'closed') return status === 'completed'
      && stageComplete('completion');
    return false;
  };

  const staffActions = (
    <>
      <button className="btn small" disabled={!can('in_progress') || busy} onClick={() => setModalTarget('in_progress')}>
        <Play size={14} /> รับงาน / เริ่ม
      </button>
      <button className="btn small" disabled={!can('completed') || busy} onClick={() => setModalTarget('completed')}>
        <CheckCircle size={14} /> เสร็จสิ้น
      </button>
      <button className="btn small" disabled={!can('closed') || busy} onClick={() => setModalTarget('closed')}>
        <Lock size={14} /> ปิดงาน
      </button>
    </>
  );

  return (
    <>
      <RequestDetail key={reloadKey} id={id} backTo="/staff" user={user} headerExtras={staffActions} onITSignClick={setSignPhase} onStepClick={setActiveStep} />
      {activeStep && request ? <SignApprovalModal request={request} step={activeStep} user={user}
        onClose={() => setActiveStep(null)}
        onDone={() => { setActiveStep(null); setReloadKey((key) => key + 1); }} /> : null}
      {(status === 'approved' && request?.request_type?.it_acceptance_required)
        || (status === 'completed' && request?.request_type?.it_completion_required) ? (
        <div className="page"><p className="muted">คลิกช่องลายเซ็น IT ในเอกสารเพื่อลงนาม{status === 'approved' ? 'รับงานก่อนเริ่มดำเนินการ' : 'ยืนยันงานเสร็จก่อนปิดงาน'}</p></div>
      ) : null}
      {signPhase && request ? <SignApprovalModal
        request={request}
        step={{ slot_label: signPhase === 'acceptance' ? 'IT ลงนามรับงาน' : 'IT ลงนามยืนยันงานเสร็จ' }}
        user={user} itPhase={signPhase}
        onClose={() => setSignPhase(null)}
        onDone={() => { setSignPhase(null); setReloadKey((key) => key + 1); }}
      /> : null}
      <ITFieldEditor requestId={id} reloadKey={reloadKey} onSaved={() => setReloadKey((k) => k + 1)} />
      {modalTarget ? (
        <StatusNoteModal
          requestId={id}
          target={modalTarget}
          busy={busy}
          onClose={() => setModalTarget(null)}
          onSubmit={(note, images) => applyStatus(modalTarget, note, images)}
        />
      ) : null}
    </>
  );
}

function ITFieldEditor({ requestId, reloadKey, onSaved }) {
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api(`/requests/${requestId}`);
        const request = data.request;
        const formData = await api(`/request-types/${request.request_type_id}/form`);
        if (cancelled) return;
        setStatus(request.status);
        setValues(request.values || {});
        setFields((formData.form?.fields || []).filter((field) =>
          field.validation?.fill_stage === 'it_after_approval',
        ));
      } catch (err) {
        if (!cancelled) setError(err.message || 'โหลดช่องสำหรับ IT ไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [requestId, reloadKey]);

  const editable = ['approved', 'in_progress', 'completed', 'closed'].includes(status);
  const setField = (name, value) => setValues((cur) => ({ ...cur, [name]: value }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const incomplete = fields.find((field) =>
        field.validation?.allow_other
        && hasIncompleteOther(values[field.field_name], field.field_type === 'checkbox'));
      if (incomplete) throw new Error(`กรุณาระบุรายละเอียด “อื่น ๆ” ในช่อง ${incomplete.field_label}`);
      const payload = {};
      for (const field of fields) payload[field.field_name] = values[field.field_name] || '';
      await api(`/requests/${requestId}/field-values`, {
        method: 'PATCH',
        body: JSON.stringify({ values: payload }),
      });
      onSaved?.();
    } catch (err) {
      setError(err.message || 'บันทึกช่องสำหรับ IT ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;
  if (!fields.length) return null;

  return (
    <div className="page it-fields-page">
      <section className="card">
        <div className="card-head">
          <h2>ข้อมูลที่ IT กรอกหลังเซ็นครบ</h2>
          <button className="btn small primary" onClick={save} disabled={!editable || saving}>
            <Save size={14} /> {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล IT'}
          </button>
        </div>
        {!editable ? (
          <p className="muted">จะแก้ไขได้หลังคำขออนุมัติครบแล้ว</p>
        ) : null}
        {error ? <p className="modal-error">{error}</p> : null}
        <div className="it-field-grid">
          {fields.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.field_label}{field.is_required ? <b>*</b> : null}</span>
              <ITFieldInput
                field={field}
                value={values[field.field_name] || ''}
                disabled={!editable || saving}
                onChange={(value) => setField(field.field_name, value)}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function ITFieldInput({ field, value, disabled, onChange }) {
  if (field.field_type === 'textarea') {
    return <textarea value={value} disabled={disabled} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.field_type === 'dropdown' || field.field_type === 'radio') {
    const selectedValue = isOtherValue(value) ? OTHER_OPTION : value;
    return (
      <div className="choice-with-other">
        <select value={selectedValue} disabled={disabled} onChange={(e) => onChange(e.target.value === OTHER_OPTION ? makeOtherValue() : e.target.value)}>
          <option value="">-- เลือก --</option>
          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          {field.validation?.allow_other ? <option value={OTHER_OPTION}>{OTHER_LABEL}</option> : null}
        </select>
        {selectedValue === OTHER_OPTION ? (
          <input
            className="other-detail-input"
            value={otherDetail(value)}
            disabled={disabled}
            placeholder="โปรดระบุรายละเอียดอื่น ๆ"
            onChange={(e) => onChange(makeOtherValue(e.target.value))}
          />
        ) : null}
      </div>
    );
  }
  if (field.field_type === 'checkbox') {
    const selected = parseMultiValue(value);
    const selectedOther = selected.find(isOtherValue);
    const setSelected = (next) => onChange(serializeMultiValue(next));
    return (
      <div className="choice-with-other">
        <div className="checkbox-list">
          {(field.options || []).map((opt) => (
            <label key={opt}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(opt)}
                onChange={(e) => setSelected(e.target.checked
                  ? [...selected, opt]
                  : selected.filter((item) => item !== opt))}
              /> {opt}
            </label>
          ))}
          {field.validation?.allow_other ? (
            <label>
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!selectedOther}
                onChange={(e) => setSelected(e.target.checked
                  ? [...selected, makeOtherValue()]
                  : selected.filter((item) => !isOtherValue(item)))}
              /> {OTHER_LABEL}
            </label>
          ) : null}
        </div>
        {selectedOther ? (
          <input
            className="other-detail-input"
            value={otherDetail(selectedOther)}
            disabled={disabled}
            placeholder="โปรดระบุรายละเอียดอื่น ๆ"
            onChange={(e) => setSelected(selected.map((item) => isOtherValue(item) ? makeOtherValue(e.target.value) : item))}
          />
        ) : null}
      </div>
    );
  }
  return (
    <input
      type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : 'text'}
      value={value}
      disabled={disabled}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function StatusNoteModal({ requestId, target, busy, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]); // { file_name, mime_type, data_base64, preview }
  const [error, setError] = useState('');
  const [completionInfo, setCompletionInfo] = useState(null); // { note, images: [{id, file_name}] } | null
  const allowImages = target === 'completed';
  const showCompletion = target === 'closed';

  useEffect(() => {
    if (!showCompletion) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/requests/${requestId}`);
        if (cancelled) return;
        const completionLog = [...(data.logs || [])]
          .reverse()
          .find((l) => l.to_status === 'completed' || l.action === 'completed');
        const completionImages = (data.attachments || []).filter((a) => a.kind === 'completion');
        setCompletionInfo({
          note: completionLog?.note || '',
          actor: completionLog?.actor_emp_id || '',
          at: completionLog?.created_at || null,
          images: completionImages,
        });
      } catch (err) {
        console.warn('load completion info failed:', err);
        setCompletionInfo({ note: '', images: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [requestId, showCompletion]);

  async function pickFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const next = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const data_base64 = await fileToBase64(file);
      next.push({
        file_name: file.name,
        mime_type: file.type,
        data_base64,
        preview: `data:${file.type};base64,${data_base64}`,
      });
    }
    setImages((cur) => [...cur, ...next]);
  }

  function removeImage(idx) {
    setImages((cur) => cur.filter((_, i) => i !== idx));
  }

  function submit() {
    const trimmed = note.trim();
    if (!trimmed) {
      setError('กรุณากรอกหมายเหตุก่อนยืนยัน');
      return;
    }
    onSubmit(trimmed, images);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>{STATUS_LABEL[target] || target}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><X size={16} /></button>
        </div>

        {showCompletion ? (
          <div className="completion-recap">
            <div className="completion-recap-head">
              <CheckCircle size={14} /> <b>สรุปจากขั้น "เสร็จสิ้น"</b>
              {completionInfo?.at ? (
                <small>· {completionInfo.actor} · {new Date(completionInfo.at).toLocaleString('th-TH')}</small>
              ) : null}
            </div>
            {completionInfo === null ? (
              <small style={{ color: 'var(--muted)' }}>กำลังโหลด…</small>
            ) : (
              <>
                <div className="completion-recap-note">
                  {completionInfo.note
                    ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{completionInfo.note}</p>
                    : <small style={{ color: 'var(--muted)' }}>(ไม่มีหมายเหตุ)</small>}
                </div>
                {completionInfo.images.length ? (
                  <div className="completion-image-grid">
                    {completionInfo.images.map((a) => (
                      <a key={a.id} className="completion-image-thumb"
                         href={`/itrequest/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                        <img src={`/itrequest/api/attachments/${a.id}`} alt={a.file_name} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <small style={{ color: 'var(--muted)' }}>(ไม่มีรูปแนบ)</small>
                )}
              </>
            )}
          </div>
        ) : null}

        <label>
          <span>หมายเหตุ <span style={{ color: '#c0392b' }}>*</span></span>
          <textarea
            autoFocus
            rows={4}
            value={note}
            onChange={(e) => { setNote(e.target.value); if (error) setError(''); }}
            placeholder="ระบุรายละเอียดการดำเนินการ"
          />
        </label>

        {allowImages ? (
          <div>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              รูปภาพประกอบ (เลือกได้หลายไฟล์)
            </span>
            <label className="btn small quiet" style={{ cursor: 'pointer' }}>
              <ImageIcon size={14} /> เลือกรูป…
              <input type="file" accept="image/*" multiple onChange={pickFiles}
                     style={{ display: 'none' }} disabled={busy} />
            </label>
            {images.length ? (
              <div className="completion-image-grid">
                {images.map((img, idx) => (
                  <div key={idx} className="completion-image-thumb">
                    <img src={img.preview} alt={img.file_name} />
                    <button type="button" className="icon-btn danger"
                            onClick={() => removeImage(idx)} aria-label="ลบรูป" disabled={busy}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="modal-error">{error}</p> : null}
        <div className="modal-actions">
          <button className="btn small quiet" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn small primary" onClick={submit} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  );
}
