import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, HardDriveDownload,
  PenLine, Search, Send, Upload, Download,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { fileToBase64 } from '../lib/fileBase64.js';
import {
  OTHER_LABEL, OTHER_OPTION, hasIncompleteOther, isOtherValue,
  makeOtherValue, otherDetail, parseMultiValue, serializeMultiValue,
} from '../lib/formOptions.js';
import { navigate } from '../lib/useHashRoute.js';

const STEPS = [
  { title: 'ประเภทคำขอ', subtitle: 'เลือกหมวด' },
  { title: 'กรอกรายละเอียด', subtitle: 'ฟอร์มตามประเภท' },
  { title: 'ผู้อนุมัติ + เซ็น', subtitle: 'Fix / เลือกเอง / ตัวคุณเอง' },
  { title: 'ตรวจสอบ & ส่ง', subtitle: 'ยืนยันคำขอ' },
];
export default function CreateRequestPage({ user }) {
  const [types, setTypes] = useState([]);
  const [step, setStep] = useState(0);
  const [requestTypeId, setRequestTypeId] = useState(null);
  const [form, setForm] = useState(null);
  const [slots, setSlots] = useState([]);
  const [values, setValues] = useState({});
  const [selectedApprovers, setSelectedApprovers] = useState({});
  const [pickedEmployees, setPickedEmployees] = useState({});
  const [signature, setSignature] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [navHost, setNavHost] = useState(null);
  const submitLock = useRef(false);

  useEffect(() => {
    api('/request-types').then((d) => {
      setTypes(d.request_types || []);
      setRequestTypeId(d.request_types?.[0]?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!requestTypeId) return;
    setForm(null); setSlots([]);
    api(`/request-types/${requestTypeId}/form`).then((data) => {
      setForm(data.form);
      setSlots(data.approval_slots || []);
    }).catch(() => {});
  }, [requestTypeId]);

  useEffect(() => {
    setNavHost(document.getElementById('topbar-step-slot'));
    return () => setNavHost(null);
  }, []);

  const requestType = types.find((t) => t.id === requestTypeId);
  const selectedSlotDetails = useMemo(() => slots.map((slot) => {
    const empId = slot.mode === 'fixed' ? slot.fixed_emp_id : selectedApprovers[slot.id];
    return { ...slot, empId };
  }), [slots, selectedApprovers]);

  const hasSelfSlot = slots.some((s) => s.mode === 'self');

  function isStepValid(idx) {
    if (idx === 0) return !!requestTypeId;
    if (idx === 1) {
      if (!form?.fields) return false;
      return form.fields.every((f) =>
        f.validation?.fill_stage === 'it_after_approval'
        || !f.is_required
        || values[f.field_name],
      );
    }
    if (idx === 2) {
      const slotsOk = slots.every((s) =>
        !s.is_required
        || s.mode === 'fixed'
        || s.mode === 'self'
        || s.mode === 'it_staff'
        || !!selectedApprovers[s.id]
      );
      const signatureOk = !hasSelfSlot || !!signature;
      return slotsOk && signatureOk;
    }
    if (idx === 3) return true;
    return false;
  }
  const maxReachable = (() => {
    for (let i = 0; i < STEPS.length; i++) {
      if (!isStepValid(i)) return i;
    }
    return STEPS.length - 1;
  })();
  const canGoNext = isStepValid(step);
  const canSend = Boolean(form && requiredOk(form, values) && isStepValid(2));
  const percent = ((step + 1) / STEPS.length) * 100;

  function gotoStep(idx) {
    if (idx <= maxReachable) setStep(idx);
  }

  function payload() {
    return {
      request_type_id: requestTypeId,
      values,
      urgency: 'normal',
      selected_approvers: selectedApprovers,
      requester_signature: signature,
    };
  }

  async function submit() {
    if (submitLock.current || !canSend) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api('/requests', { method: 'POST', body: JSON.stringify(payload()) });
      await uploadPendingAttachments(result.request.id);
      setSubmitResult({ type: 'submit', data: result });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(error.message || 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่');
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPendingAttachments(requestId) {
    for (const a of attachments) {
      try {
        await api(`/requests/${requestId}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            file_name: a.file_name, mime_type: a.mime_type, data_base64: a.data_base64,
          }),
        });
      } catch (err) { console.warn('upload fail', err); }
    }
  }

  return (
    <>
      {navHost && !submitResult ? createPortal(
        <StepRail step={step} gotoStep={gotoStep} maxReachable={maxReachable} />,
        navHost,
      ) : null}
      <div className="app-shell">
        <main className="main">
        {submitResult ? (
          <SubmissionSuccess result={submitResult.data} />
        ) : (
          <>
            <div className="progress"><i style={{ width: `${percent}%` }} /></div>
            <section className="stage">
              <DocumentSheet
                user={user} step={step}
                requestType={requestType} requestTypes={types}
                requestTypeId={requestTypeId} setRequestTypeId={setRequestTypeId}
                form={form} values={values} setValues={setValues}
                slots={slots} selectedApprovers={selectedApprovers}
                setSelectedApprovers={setSelectedApprovers}
                pickedEmployees={pickedEmployees} setPickedEmployees={setPickedEmployees}
                signature={signature} setSignature={setSignature}
                attachments={attachments} setAttachments={setAttachments}
                selectedSlotDetails={selectedSlotDetails}
                stepNav={(
                  <SheetNav
                    step={step} setStep={setStep}
                    submit={submit}
                    canGoNext={canGoNext} canSend={canSend}
                    submitting={submitting} submitError={submitError}
                  />
                )}
              />
            </section>
          </>
        )}
        </main>
      </div>
    </>
  );
}

function SubmissionSuccess({ result }) {
  return (
    <section className="submission-success-screen" aria-live="polite">
      <div className="submission-success-card">
        <CheckCircle2 className="submission-success-icon" size={56} strokeWidth={1.8} />
        <p className="submission-success-kicker">ส่งข้อมูลเข้าสู่ระบบแล้ว</p>
        <h1>ส่งคำขอเรียบร้อย</h1>
        <p>เลขที่คำขอ</p>
        <strong className="submission-request-number">{result.request.request_no}</strong>
        <div className="submission-success-actions">
          <button className="btn primary big" onClick={() => navigate(`/my/${result.request.id}`)}>
            <FileText size={18} /> ดูรายละเอียดคำขอ
          </button>
          <button className="btn quiet big" onClick={() => navigate('/my')}>กลับไปคำขอของฉัน</button>
        </div>
        <small>ระบบปิดแบบฟอร์มนี้แล้ว จึงไม่สามารถกดส่งรายการเดิมซ้ำได้</small>
      </div>
    </section>
  );
}

function requiredOk(form, values) {
  if (!form?.fields) return true;
  for (const f of form.fields) {
    if (f.validation?.fill_stage === 'it_after_approval') continue;
    if (f.is_required && !values[f.field_name]) return false;
    if (f.validation?.allow_other && hasIncompleteOther(values[f.field_name], f.field_type === 'checkbox')) return false;
  }
  return true;
}

function StepRail({ step, gotoStep, maxReachable }) {
  return (
    <nav className="step-navbar">
      <div className="brand">
        <div className="brand-mark">IT</div>
        <div>
          <strong>สร้างคำขอใหม่</strong>
          <span>ทำตามขั้นตอนทีละหน้า</span>
        </div>
      </div>
      <div className="steps">
        {STEPS.map((item, index) => {
          const done = index < step;
          const current = index === step;
          const locked = index > maxReachable;
          return (
            <button key={item.title}
              className={`step ${current ? 'current' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked}
              onClick={() => gotoStep(index)}>
              <span className="step-dot">
                {done ? <Check size={15} /> : locked ? '🔒' : index + 1}
              </span>
              <span className="step-label">
                <span>{item.title}</span>
                <small>{locked ? 'ทำขั้นก่อนหน้าให้เสร็จ' : item.subtitle}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="rail-bottom">
        <button className="btn small quiet" onClick={() => navigate('/my')}>
          → ดูคำขอของฉัน
        </button>
      </div>
    </nav>
  );
}

function DocumentSheet({
  user, step, requestType, requestTypes, requestTypeId, setRequestTypeId,
  form, values, setValues, slots,
  selectedApprovers, setSelectedApprovers,
  pickedEmployees, setPickedEmployees,
  signature, setSignature,
  attachments, setAttachments, selectedSlotDetails, stepNav,
}) {
  return (
    <div className="sheet">
      <header className="doc-head">
        <div className="seal">IT</div>
        <div>
          <div className="org">แผนกเทคโนโลยีสารสนเทศ</div>
          <h1>ใบคำขอใช้งาน IT</h1>
        </div>
        <div className="doc-meta">
          <div>เลขที่ <b>รอสร้างเลข</b></div>
          <div>วันที่ <b>{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date())}</b></div>
        </div>
      </header>

      <div className="requester-strip">
        <ReadLine label="ชื่อผู้ขอ" value={user?.name || '-'} />
        <ReadLine label="แผนก" value={user?.department || '-'} />
      </div>

      <DocSection index={0} step={step} title="ประเภทคำขอ" stepNav={stepNav}>
        {(active) => active ? (
          <div className="type-grid">
            {requestTypes.map((type) => (
              <button key={type.id}
                className={`type-card ${type.id === requestTypeId ? 'selected' : ''}`}
                onClick={() => setRequestTypeId(type.id)}>
                <FileText size={22} />
                <b>{type.name}</b>
                <span>{type.description}</span>
              </button>
            ))}
            {requestTypes.length === 0 ? <p style={{ color: '#888' }}>ยังไม่มีประเภทคำขอในระบบ — Admin ต้องสร้างก่อน</p> : null}
          </div>
        ) : <ReadLine label="" value={requestType?.name || '-'} />}
      </DocSection>

      <DocSection index={1} step={step} title="รายละเอียดคำขอ" stepNav={stepNav}>
        {(active) => active ? (
          <DynamicForm fields={form?.fields || []} values={values} setValues={setValues}
                       attachments={attachments} setAttachments={setAttachments} />
        ) : (
          <div className="read-stack">
            <ReadLine label="หัวข้อ" value={values.title} />
            <ReadLine label="รายละเอียด" value={values.detail} block />
          </div>
        )}
      </DocSection>

      <DocSection index={2} step={step} title="ผู้อนุมัติ + เซ็น" stepNav={stepNav}>
        {(active) => active ? (
          <>
            <ApprovalPicker slots={slots} selected={selectedApprovers} setSelected={setSelectedApprovers}
                            picked={pickedEmployees} setPicked={setPickedEmployees} />
            {slots.some((s) => s.mode === 'self') ? (
              <div className="self-sign-box">
                <h3>ลายเซ็นของคุณ (ช่อง "ผู้ขอเซ็นเอง")</h3>
                <SignaturePanel user={user} signature={signature} setSignature={setSignature} />
              </div>
            ) : null}
          </>
        ) : (
          <ApprovalPreview slots={selectedSlotDetails} selected={selectedApprovers}
                           picked={pickedEmployees} signature={signature} />
        )}
      </DocSection>

      {step === 3 ? (
        <DocSection index={3} step={step} title="ตรวจสอบ & ส่ง" stepNav={stepNav}>
          {() => (
            <div className="read-stack">
              <ReadLine label="ประเภทคำขอ" value={requestType?.name} />
              <ReadLine label="หัวข้อ" value={values.title} />
              <ReadLine label="รายละเอียด" value={values.detail} block />
              <ReadLine label="ลายเซ็น" value={signature ? `เซ็นแล้ว (${signature.type === 'draw' ? 'วาด' : 'ดึงรูป'})` : 'ไม่ใช้ (ไม่มีช่อง self)'} />
              <ReadLine label="ไฟล์แนบ" value={`${attachments.length} ไฟล์`} />
            </div>
          )}
        </DocSection>
      ) : null}
    </div>
  );
}

function DocSection({ index, step, title, children, stepNav }) {
  const active = step === index;
  const dim = step < 4 && !active;
  return (
    <section className={`doc-section ${active ? 'active' : ''} ${dim ? 'dim' : ''}`}>
      <h2>{title}{active ? <span>กรอกตรงนี้</span> : null}</h2>
      {children(active)}
      {active ? stepNav : null}
    </section>
  );
}

function DynamicForm({ fields, values, setValues, attachments, setAttachments }) {
  const setField = (name, value) => setValues((cur) => ({ ...cur, [name]: value }));
  const visibleFields = fields.filter((field) => field.validation?.fill_stage !== 'it_after_approval');

  function applyEmployeeSelection(field, employee) {
    const linkGroup = field.validation?.employee_link_group || '';
    setValues((cur) => {
      const next = {
        ...cur,
        [field.field_name]: employeeValue(employee, field.validation?.source_value || 'name'),
      };
      if (field.validation?.employee_linked) {
        for (const peer of visibleFields) {
          if (peer.field_name === field.field_name) continue;
          if (peer.validation?.source !== 'employees') continue;
          if (!peer.validation?.employee_linked) continue;
          if ((peer.validation?.employee_link_group || '') !== linkGroup) continue;
          next[peer.field_name] = employeeValue(employee, peer.validation?.source_value || 'name');
        }
      }
      return next;
    });
  }

  async function pickFile(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const b64 = await fileToBase64(file);
      setAttachments((curr) => [...curr, {
        file_name: file.name, mime_type: file.type, data_base64: b64, size: file.size,
      }]);
    }
    e.target.value = '';
  }

  return (
    <>
      {visibleFields.map((field) => (
        <label className="field" key={field.id}>
          <span>{field.field_label}{field.is_required ? <b>*</b> : null}</span>
          {field.validation?.source === 'employees' ? (
            <EmployeeValuePicker
              value={values[field.field_name] || ''}
              valueKey={field.validation?.source_value || 'name'}
              placeholder={field.placeholder || 'พิมพ์ชื่อหรือรหัสพนักงาน'}
              onChange={(value) => setField(field.field_name, value)}
              onSelectEmployee={(employee) => applyEmployeeSelection(field, employee)}
            />
          ) : field.field_type === 'textarea' ? (
            <textarea value={values[field.field_name] || ''} placeholder={field.placeholder}
                      onChange={(e) => setField(field.field_name, e.target.value)} />
          ) : ['dropdown', 'radio', 'checkbox'].includes(field.field_type) ? (
            <ChoiceFieldInput
              field={field}
              value={values[field.field_name] || ''}
              onChange={(value) => setField(field.field_name, value)}
            />
          ) : (
            <input type={field.field_type === 'date' ? 'date'
                      : field.field_type === 'number' ? 'number'
                      : field.field_type === 'email' ? 'email' : 'text'}
                   value={values[field.field_name] || ''} placeholder={field.placeholder}
                   onChange={(e) => setField(field.field_name, e.target.value)} />
          )}
        </label>
      ))}
      <label className="file-box">
        <Upload size={18} />
        <span><b>แนบไฟล์</b> PDF หรือรูปภาพ (เลือกหลายไฟล์ได้)</span>
        <input type="file" multiple onChange={pickFile} style={{ display: 'none' }} />
      </label>
      {attachments.length ? (
        <ul className="attachment-list small">
          {attachments.map((a, i) => (
            <li key={i}>
              📎 {a.file_name} <small>({Math.round((a.size || 0) / 1024)} KB)</small>
              <button className="link" onClick={() => setAttachments((curr) => curr.filter((_, j) => j !== i))}>ลบ</button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function ChoiceFieldInput({ field, value, onChange }) {
  const allowOther = !!field.validation?.allow_other;

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
                checked={selected.includes(opt)}
                onChange={(e) => setSelected(e.target.checked
                  ? [...selected, opt]
                  : selected.filter((item) => item !== opt))}
              /> {opt}
            </label>
          ))}
          {allowOther ? (
            <label>
              <input
                type="checkbox"
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
            autoFocus
            placeholder="โปรดระบุรายละเอียดอื่น ๆ"
            onChange={(e) => setSelected(selected.map((item) => isOtherValue(item) ? makeOtherValue(e.target.value) : item))}
          />
        ) : null}
      </div>
    );
  }

  const selectedValue = isOtherValue(value) ? OTHER_OPTION : value;
  return (
    <div className="choice-with-other">
      <select value={selectedValue || ''} onChange={(e) => onChange(e.target.value === OTHER_OPTION ? makeOtherValue() : e.target.value)}>
        <option value="">-- เลือก --</option>
        {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        {allowOther ? <option value={OTHER_OPTION}>{OTHER_LABEL}</option> : null}
      </select>
      {selectedValue === OTHER_OPTION ? (
        <input
          className="other-detail-input"
          value={otherDetail(value)}
          autoFocus
          placeholder="โปรดระบุรายละเอียดอื่น ๆ"
          onChange={(e) => onChange(makeOtherValue(e.target.value))}
        />
      ) : null}
    </div>
  );
}

function EmployeeValuePicker({ value, valueKey = 'name', placeholder, onChange, onSelectEmployee }) {
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    api(`/employees?q=${encodeURIComponent(q)}`)
      .then((d) => {
        if (!cancelled) setEmployees(d.employees || []);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="employee-field-picker">
      <div className="employee-search">
        <Search size={17} />
        <input
          value={query || value}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onChange('');
          }}
        />
      </div>
      {query ? (
        <div className="search-menu">
          {employees.slice(0, 8).map((emp) => (
            <button key={emp.emp_id} type="button" onClick={() => {
              if (onSelectEmployee) onSelectEmployee(emp);
              else onChange(employeeValue(emp, valueKey));
              setQuery('');
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <b>{emp.name}</b>
                <small style={{ color: '#888' }}>
                  {[emp.emp_id, emp.position, emp.department].filter(Boolean).join(' · ') || '-'}
                </small>
              </div>
            </button>
          ))}
          {!employees.length ? <small style={{ padding: 10, color: '#888' }}>ไม่พบพนักงาน</small> : null}
        </div>
      ) : null}
    </div>
  );
}

function employeeValue(emp, key) {
  if (key === 'badge_label') {
    return emp?.nickname || emp?.name || emp?.emp_id || '';
  }
  const value = emp?.[key];
  if (value !== null && value !== undefined && String(value).trim()) return String(value);
  return emp?.name || emp?.emp_id || '';
}

function ApprovalPicker({ slots, selected, setSelected, picked, setPicked }) {
  return (
    <div className="approval-list">
      {slots.map((slot) => (
        <ApprovalSlot key={slot.id} slot={slot} selected={selected} setSelected={setSelected}
                      picked={picked} setPicked={setPicked} />
      ))}
      {slots.length === 0 ? <p style={{ color: '#888' }}>ฟอร์มนี้ไม่ได้กำหนดช่องเซ็น</p> : null}
    </div>
  );
}

function ApprovalSlot({ slot, selected, setSelected, picked, setPicked }) {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState('');
  const selectedEmpId = selected[slot.id];
  const cached = picked?.[slot.id];
  const selectedEmployee = (cached?.emp_id === selectedEmpId ? cached : null)
    || employees.find((emp) => emp.emp_id === selectedEmpId);

  useEffect(() => {
    if (slot.mode !== 'selectable') return;
    api(`/employees?q=${encodeURIComponent(query)}`).then((d) => setEmployees(d.employees || []));
  }, [query, slot.mode]);

  useEffect(() => {
    if (slot.mode !== 'selectable' || !selectedEmpId) return;
    if (cached?.emp_id === selectedEmpId) return;
    api(`/employees?q=${encodeURIComponent(selectedEmpId)}`).then((d) => {
      const found = (d.employees || []).find((e) => e.emp_id === selectedEmpId);
      if (found) setPicked?.((cur) => ({ ...cur, [slot.id]: found }));
    });
  }, [selectedEmpId, slot.mode]);

  if (slot.mode === 'fixed') {
    return (
      <div className="approval-slot">
        <div className="slot-no">{slot.step_no}</div>
        <div className="slot-main">
          <small>{slot.slot_label}</small>
          <AvatarEmployee employee={slot.fixed_employee} />
        </div>
        <span className="pill muted">🔒 กำหนดไว้แล้ว</span>
      </div>
    );
  }
  if (slot.mode === 'it_staff') {
    return <div className="approval-slot">
      <div className="slot-no">{slot.step_no}</div>
      <div className="slot-main"><small>{slot.slot_label}</small><b>เจ้าหน้าที่ IT ที่รับงาน</b></div>
      <span className="pill muted">{slot.sign_stage === 'acceptance' ? 'ก่อนเริ่มงาน' : slot.sign_stage === 'completion' ? 'ก่อนปิดงาน' : 'ขั้นอนุมัติ'}</span>
    </div>;
  }
  if (slot.mode === 'self') {
    return (
      <div className="approval-slot">
        <div className="slot-no">{slot.step_no}</div>
        <div className="slot-main">
          <small>{slot.slot_label}</small>
          <div className="employee-name">
            <span className="avatar self">ME</span>ตัวคุณเอง (เซ็นที่นี่)
          </div>
        </div>
        <span className="pill accent">👤 ผู้ขอเซ็นเอง</span>
      </div>
    );
  }
  return (
    <div className="approval-slot pick">
      <div className="slot-no">{slot.step_no}</div>
      <div className="slot-main">
        <small>{slot.slot_label}{slot.is_required ? '' : ' (ถ้ามี)'}</small>
        {selectedEmployee ? (
          <div className="employee-name" style={{ marginBottom: 6 }}>
            <span className="avatar">{selectedEmployee.name?.slice(0, 2) || '?'}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <b>{selectedEmployee.name}</b>
              <small style={{ color: '#666' }}>
                {[selectedEmployee.position, selectedEmployee.department].filter(Boolean).join(' · ') || '-'}
              </small>
            </div>
            <button className="btn small quiet" style={{ marginLeft: 'auto' }}
                    onClick={() => {
                      setSelected((cur) => { const n = { ...cur }; delete n[slot.id]; return n; });
                      setPicked?.((cur) => { const n = { ...cur }; delete n[slot.id]; return n; });
                    }}>
              เปลี่ยน
            </button>
          </div>
        ) : null}
        <div className="employee-search">
          <Search size={17} />
          <input value={query}
                 placeholder={selectedEmployee ? 'ค้นหาเพื่อเปลี่ยน…' : 'พิมพ์ชื่อพนักงาน'}
                 onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query ? (
          <div className="search-menu">
            {employees.slice(0, 6).map((emp) => (
              <button key={emp.emp_id} onClick={() => {
                setSelected((cur) => ({ ...cur, [slot.id]: emp.emp_id }));
                setPicked?.((cur) => ({ ...cur, [slot.id]: emp }));
                setQuery('');
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <b>{emp.name}</b>
                  <small style={{ color: '#888' }}>
                    {[emp.position, emp.department].filter(Boolean).join(' · ') || '-'}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span className={`pill ${slot.is_required ? 'accent' : 'optional'}`}>
        {slot.is_required ? 'เลือกเอง' : 'ข้ามได้'}
      </span>
    </div>
  );
}

function ApprovalPreview({ slots, selected, picked, signature }) {
  const modeLabel = (m) => m === 'fixed' ? 'กำหนดไว้' : m === 'self' ? 'ตัวคุณเอง' : m === 'it_staff' ? 'เจ้าหน้าที่ IT' : 'เลือกเอง';
  return (
    <div className="sig-grid">
      {slots.slice(0, 6).map((slot) => {
        const emp = slot.mode === 'fixed'
          ? slot.fixed_employee
          : (slot.mode === 'selectable' ? picked?.[slot.id] : null);
        const name = emp?.name
          || (slot.mode === 'self' ? 'ตัวคุณเอง' : slot.mode === 'it_staff' ? 'เจ้าหน้าที่ IT ที่รับงาน' : selected[slot.id] || 'ยังไม่ได้เลือก');
        const sub = [emp?.position, emp?.department].filter(Boolean).join(' · ');
        return (
          <div className="sig-cell" key={slot.id}>
            <div><span>{slot.slot_label}</span><span>{modeLabel(slot.mode)}</span></div>
            <div className="sig-empty">
              {slot.mode === 'self' && signature ? <img src={signature.data} alt="ลายเซ็น" /> : null}
            </div>
            <b>{name}</b>
            {sub ? <small style={{ color: '#666' }}>{sub}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function SignaturePanel({ user, signature, setSignature }) {
  const hasSystemSignature = Boolean(user?.has_signature && user?.signature_url);
  // มีลายเซ็นในระบบ → default เป็น "ใช้ลายเซ็นเดิม"
  const [mode, setMode] = useState(() => signature?.type || (hasSystemSignature ? 'fetch' : 'draw'));
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

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function start(e) {
    e.preventDefault(); drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    setSignature({ type: 'draw', data: canvasRef.current.toDataURL('image/png') });
  }
  function useFetched() {
    if (!hasSystemSignature) return;
    setSignature({ type: 'fetch', data: user.signature_url });
  }

  useEffect(() => {
    if (!hasSystemSignature || signature) return;
    setMode('fetch');
    setSignature({ type: 'fetch', data: user.signature_url });
  }, [hasSystemSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const signerLabel = [user?.name, user?.emp_id ? `(${user.emp_id})` : ''].filter(Boolean).join(' ');

  return (
    <div>
      <div className="signature-signer" style={{
        marginBottom: 10, padding: '8px 12px', borderRadius: 8,
        background: '#fff7e6', border: '1px solid #f5c26b', color: '#7a4b00', fontSize: 14,
      }}>
        คุณกำลังเซ็นในนาม <b>{signerLabel || '-'}</b>
        <div style={{ fontSize: 12, marginTop: 2 }}>
          หากไม่ใช่คุณ กรุณาออกจากระบบแล้วเข้าสู่ระบบด้วยบัญชีของตัวเองก่อนเซ็น
        </div>
      </div>
      <div className="signature-tabs">
        <button className={mode === 'draw' ? 'selected' : ''} onClick={() => { setMode('draw'); if (signature?.type === 'fetch') setSignature(null); }}>
          <PenLine size={17} />วาดลายเซ็น
        </button>
        {hasSystemSignature ? (
          <button className={mode === 'fetch' ? 'selected' : ''} onClick={() => { setMode('fetch'); useFetched(); }}>
            <Download size={17} />ใช้ลายเซ็นเดิม
          </button>
        ) : null}
      </div>
      {mode === 'draw' ? (
        <>
          <canvas className="signature-pad" ref={canvasRef}
            onMouseDown={start} onMouseMove={move}
            onMouseUp={() => { drawing.current = false; }}
            onMouseLeave={() => { drawing.current = false; }}
            onTouchStart={start} onTouchMove={move}
            onTouchEnd={() => { drawing.current = false; }} />
          <div className="signature-actions">
            <span>เซ็นในนาม {signerLabel || 'ผู้ขอใช้งาน'}</span>
            <button onClick={() => {
              const c = canvasRef.current;
              c.getContext('2d').clearRect(0, 0, c.width, c.height);
              setSignature(null);
            }}>ล้าง</button>
          </div>
        </>
      ) : (
        <div className="signature-fetch">
          <HardDriveDownload size={22} />
          {signature?.data ? <img src={signature.data} alt="ลายเซ็น" style={{ maxHeight: 80 }} /> : <span>—</span>}
        </div>
      )}
    </div>
  );
}

function SheetNav({ step, setStep, submit, canGoNext, canSend, submitting, submitError }) {
  return (
    <nav className="sheet-nav">
      <div className="sheet-nav-left">
        {step > 0 ? (
          <button className="btn quiet" disabled={submitting} onClick={() => setStep((v) => v - 1)}>
            <ArrowLeft size={18} />ย้อนกลับ
          </button>
        ) : null}
      </div>
      <div className="sheet-nav-context">
        ขั้นตอน <b>{step + 1}</b> / {STEPS.length}
        {canGoNext ? '' : ' · ยังกรอกไม่ครบ'}
      </div>
      <div className="sheet-nav-right">
        {step < STEPS.length - 1 ? (
          <button className="btn primary big" disabled={!canGoNext}
            onClick={() => setStep((v) => v + 1)}>
            ถัดไป: {STEPS[step + 1].title}<ArrowRight size={18} />
          </button>
        ) : (
          <div className="submit-action">
            <button className="btn send big" disabled={!canSend || submitting} onClick={submit}>
              <Send size={18} />{submitting ? 'กำลังส่ง…' : 'ส่งคำขอ'}
            </button>
            {submitError ? <span className="submit-error" role="alert">{submitError}</span> : null}
          </div>
        )}
      </div>
    </nav>
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

function AvatarEmployee({ employee }) {
  return (
    <div className="slot-main">
      <small>{employee?.position || 'ผู้อนุมัติ'}</small>
      <div className="employee-name">
        <span className="avatar">{employee?.name?.slice(0, 2) || '?'}</span>
        {employee?.name || '-'}
      </div>
    </div>
  );
}
