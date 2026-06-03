import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  HardDriveDownload,
  PenLine,
  Save,
  Search,
  Send,
  Upload,
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/itrequest/api';
const EMP_PICTURE_URL = import.meta.env.VITE_EMP_PICTURE_URL || 'http://www.pssugar.com/empPicture';

const STEPS = [
  { title: 'ประเภทคำขอ', subtitle: 'เลือกหมวด' },
  { title: 'กรอกรายละเอียด', subtitle: 'ฟอร์มตามประเภท' },
  { title: 'เลือกผู้อนุมัติ', subtitle: 'Fix / เลือกเอง' },
  { title: 'เซ็นรับรอง', subtitle: 'วาดหรือดึงลายเซ็น' },
  { title: 'ตรวจสอบ & ส่ง', subtitle: 'ยืนยันคำขอ' },
];

const URGENCY = [
  { id: 'normal', label: 'ปกติ' },
  { id: 'urgent', label: 'เร่งด่วน' },
  { id: 'critical', label: 'ด่วนที่สุด' },
];

function App() {
  const [boot, setBoot] = useState({ user: null, types: [] });
  const [step, setStep] = useState(0);
  const [requestTypeId, setRequestTypeId] = useState(1);
  const [form, setForm] = useState(null);
  const [slots, setSlots] = useState([]);
  const [values, setValues] = useState({
    title: 'ขอติดตั้งโปรแกรม Photoshop',
    detail: 'ใช้สำหรับงานออกแบบสื่อประชาสัมพันธ์ภายในบริษัท ขอติดตั้งที่เครื่องคอมพิวเตอร์ของแผนกบัญชี',
    software_name: 'Adobe Photoshop 2024',
    required_date: '2026-06-10',
    phone: '1234',
  });
  const [urgency, setUrgency] = useState('urgent');
  const [selectedApprovers, setSelectedApprovers] = useState({ 2: '010882', 4: '010882' });
  const [signature, setSignature] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    Promise.all([api('/me'), api('/request-types')]).then(([me, types]) => {
      setBoot({ user: me.user, types: types.request_types });
      setRequestTypeId(types.request_types[0]?.id || 1);
    });
  }, []);

  useEffect(() => {
    if (!requestTypeId) return;
    api(`/request-types/${requestTypeId}/form`).then((data) => {
      setForm(data.form);
      setSlots(data.approval_slots);
    });
  }, [requestTypeId]);

  const requestType = boot.types.find((type) => type.id === requestTypeId);
  const selectedSlotDetails = useMemo(() => slots.map((slot) => {
    const empId = slot.mode === 'fixed' ? slot.fixed_emp_id : selectedApprovers[slot.id];
    const approver = slot.fixed_employee || null;
    return { ...slot, empId, approver };
  }), [slots, selectedApprovers]);

  const canSend = Boolean(values.title && values.detail && signature);
  const percent = ((step + 1) / STEPS.length) * 100;

  async function saveDraft() {
    const result = await api('/requests/draft', {
      method: 'POST',
      body: JSON.stringify(payload('draft')),
    });
    setSubmitResult({ type: 'draft', data: result });
  }

  async function submit() {
    const result = await api('/requests', {
      method: 'POST',
      body: JSON.stringify(payload('submit')),
    });
    setSubmitResult({ type: 'submit', data: result });
  }

  function payload() {
    return {
      request_type_id: requestTypeId,
      values,
      urgency,
      selected_approvers: selectedApprovers,
      requester_signature: signature,
    };
  }

  return (
    <div className="app-shell">
      <Rail step={step} setStep={setStep} />
      <main className="main">
        <div className="progress"><i style={{ width: `${percent}%` }} /></div>
        <section className="stage">
          <DocumentSheet
            user={boot.user}
            step={step}
            requestType={requestType}
            requestTypes={boot.types}
            requestTypeId={requestTypeId}
            setRequestTypeId={setRequestTypeId}
            form={form}
            values={values}
            setValues={setValues}
            urgency={urgency}
            setUrgency={setUrgency}
            slots={slots}
            selectedApprovers={selectedApprovers}
            setSelectedApprovers={setSelectedApprovers}
            signature={signature}
            setSignature={setSignature}
            submitResult={submitResult}
            selectedSlotDetails={selectedSlotDetails}
          />
        </section>
      </main>
      <FooterNav
        step={step}
        setStep={setStep}
        saveDraft={saveDraft}
        submit={submit}
        canSend={canSend}
      />
    </div>
  );
}

function Rail({ step, setStep }) {
  return (
    <aside className="rail">
      <div className="brand">
        <div className="brand-mark">IT</div>
        <div>
          <strong>ระบบขอใช้งาน IT</strong>
          <span>สร้างคำขอใหม่</span>
        </div>
      </div>
      <div className="steps">
        {STEPS.map((item, index) => (
          <button
            key={item.title}
            className={`step ${index === step ? 'current' : ''} ${index < step ? 'done' : ''}`}
            onClick={() => setStep(index)}
          >
            <span className="step-dot">{index < step ? <Check size={15} /> : index + 1}</span>
            <span className="step-label">
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="rail-note">
        ข้อมูลผู้ใช้, รายชื่อพนักงาน, SMTP และฐานข้อมูลยังเป็น mock จนกว่าจะได้ข้อมูลระบบเดิม
      </div>
    </aside>
  );
}

function DocumentSheet(props) {
  const {
    user,
    step,
    requestType,
    requestTypes,
    requestTypeId,
    setRequestTypeId,
    form,
    values,
    setValues,
    urgency,
    setUrgency,
    slots,
    selectedApprovers,
    setSelectedApprovers,
    signature,
    setSignature,
    submitResult,
    selectedSlotDetails,
  } = props;

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
        <ReadLine label="ชื่อผู้ขอ" value={user?.name || 'กำลังโหลด'} />
        <ReadLine label="แผนก" value={user?.department || '-'} />
      </div>

      <DocSection index={0} step={step} title="ประเภทคำขอ">
        {(active) => active ? (
          <div className="type-grid">
            {requestTypes.map((type) => (
              <button
                key={type.id}
                className={`type-card ${type.id === requestTypeId ? 'selected' : ''}`}
                onClick={() => setRequestTypeId(type.id)}
              >
                <FileText size={22} />
                <b>{type.name}</b>
                <span>{type.description}</span>
              </button>
            ))}
          </div>
        ) : <ReadLine label="" value={requestType?.name || '-'} />}
      </DocSection>

      <DocSection index={1} step={step} title="รายละเอียดคำขอ">
        {(active) => active ? (
          <DynamicForm fields={form?.fields || []} values={values} setValues={setValues} urgency={urgency} setUrgency={setUrgency} />
        ) : (
          <div className="read-stack">
            <ReadLine label="หัวข้อ" value={values.title} />
            <ReadLine label="รายละเอียด" value={values.detail} block />
            <ReadLine label="เร่งด่วน" value={URGENCY.find((item) => item.id === urgency)?.label} />
            <ReadLine label="ใช้วันที่" value={values.required_date} />
          </div>
        )}
      </DocSection>

      <DocSection index={2} step={step} title="ผู้อนุมัติ">
        {(active) => active ? (
          <ApprovalPicker slots={slots} selected={selectedApprovers} setSelected={setSelectedApprovers} />
        ) : (
          <ApprovalPreview slots={selectedSlotDetails} selected={selectedApprovers} />
        )}
      </DocSection>

      <DocSection index={3} step={step} title="ลายเซ็นผู้ขอ">
        {(active) => active ? (
          <SignaturePanel user={user} signature={signature} setSignature={setSignature} />
        ) : (
          <div className="signature-read">
            {signature ? <img src={signature.data} alt="ลายเซ็นผู้ขอ" /> : <span>ยังไม่ได้ลงนาม</span>}
          </div>
        )}
      </DocSection>

      {step === 4 ? (
        <ReviewPanel
          values={values}
          requestType={requestType}
          urgency={urgency}
          signature={signature}
          submitResult={submitResult}
        />
      ) : null}
    </div>
  );
}

function DocSection({ index, step, title, children }) {
  const active = step === index;
  const dim = step < 4 && !active;
  return (
    <section className={`doc-section ${active ? 'active' : ''} ${dim ? 'dim' : ''}`}>
      <h2>{title}{active ? <span>กรอกตรงนี้</span> : null}</h2>
      {children(active)}
    </section>
  );
}

function DynamicForm({ fields, values, setValues, urgency, setUrgency }) {
  const setField = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  return (
    <>
      {fields.map((field) => (
        <label className="field" key={field.id}>
          <span>{field.field_label}{field.is_required ? <b>*</b> : null}</span>
          {field.field_type === 'textarea' ? (
            <textarea value={values[field.field_name] || ''} placeholder={field.placeholder} onChange={(e) => setField(field.field_name, e.target.value)} />
          ) : (
            <input type={field.field_type === 'date' ? 'date' : 'text'} value={values[field.field_name] || ''} placeholder={field.placeholder} onChange={(e) => setField(field.field_name, e.target.value)} />
          )}
        </label>
      ))}
      <div className="field">
        <span>ความเร่งด่วน</span>
        <div className="urgency">
          {URGENCY.map((item) => (
            <button key={item.id} className={urgency === item.id ? 'selected' : ''} onClick={() => setUrgency(item.id)}>
              <i />{item.label}
            </button>
          ))}
        </div>
      </div>
      <button className="file-box">
        <Upload size={18} />
        <span><b>แนบไฟล์</b> PDF หรือรูปภาพ</span>
      </button>
    </>
  );
}

function ApprovalPicker({ slots, selected, setSelected }) {
  return (
    <div className="approval-list">
      {slots.map((slot) => (
        <ApprovalSlot key={slot.id} slot={slot} selected={selected} setSelected={setSelected} />
      ))}
    </div>
  );
}

function ApprovalSlot({ slot, selected, setSelected }) {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState('');
  const selectedEmployee = employees.find((employee) => employee.emp_id === selected[slot.id]);

  useEffect(() => {
    api(`/employees?q=${encodeURIComponent(query)}`).then((data) => setEmployees(data.employees));
  }, [query]);

  if (slot.mode === 'fixed') {
    return (
      <div className="approval-slot">
        <div className="slot-no">{slot.step_no}</div>
        <AvatarEmployee employee={slot.fixed_employee} />
        <span className="pill muted">กำหนดไว้แล้ว</span>
      </div>
    );
  }

  return (
    <div className="approval-slot pick">
      <div className="slot-no">{slot.step_no}</div>
      <div className="slot-main">
        <small>{slot.slot_label}{slot.is_required ? '' : ' (ถ้ามี)'}</small>
        <div className="employee-search">
          <Search size={17} />
          <input value={query} placeholder={selectedEmployee?.name || 'พิมพ์ชื่อพนักงาน'} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {query ? (
          <div className="search-menu">
            {employees.slice(0, 4).map((employee) => (
              <button key={employee.emp_id} onClick={() => {
                setSelected((current) => ({ ...current, [slot.id]: employee.emp_id }));
                setQuery('');
              }}>
                {employee.name}<span>{employee.department}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span className={`pill ${slot.is_required ? 'accent' : 'optional'}`}>{slot.is_required ? 'เลือกเอง' : 'ข้ามได้'}</span>
    </div>
  );
}

function ApprovalPreview({ slots, selected }) {
  return (
    <div className="sig-grid">
      {slots.slice(0, 4).map((slot) => (
        <div className="sig-cell" key={slot.id}>
          <div><span>{slot.slot_label}</span><span>{slot.mode === 'fixed' ? 'กำหนดไว้' : 'เลือกเอง'}</span></div>
          <div className="sig-empty" />
          <b>{slot.approver?.name || selected[slot.id] || 'ยังไม่ได้เลือก'}</b>
        </div>
      ))}
    </div>
  );
}

function SignaturePanel({ user, signature, setSignature }) {
  const [mode, setMode] = useState('draw');
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
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

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  function start(event) {
    event.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(event) {
    if (!drawing.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setSignature({ type: 'draw', data: canvasRef.current.toDataURL('image/png') });
  }

  function useFetched() {
    setSignature({ type: 'fetch', data: `${EMP_PICTURE_URL}/${user?.emp_id || '021093'}.jpg` });
  }

  return (
    <div>
      <div className="signature-tabs">
        <button className={mode === 'draw' ? 'selected' : ''} onClick={() => setMode('draw')}><PenLine size={17} />วาดลายเซ็น</button>
        <button className={mode === 'fetch' ? 'selected' : ''} onClick={() => { setMode('fetch'); useFetched(); }}><Download size={17} />ใช้ลายเซ็นเดิม</button>
      </div>
      {mode === 'draw' ? (
        <>
          <canvas
            className="signature-pad"
            ref={canvasRef}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={() => { drawing.current = false; }}
            onMouseLeave={() => { drawing.current = false; }}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={() => { drawing.current = false; }}
          />
          <div className="signature-actions">
            <span>เซ็นในนามผู้ขอใช้งาน</span>
            <button onClick={() => {
              const canvas = canvasRef.current;
              canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
              setSignature(null);
            }}>ล้าง</button>
          </div>
        </>
      ) : (
        <div className="signature-fetch">
          <HardDriveDownload size={22} />
          <span>{signature?.data}</span>
        </div>
      )}
    </div>
  );
}

function ReviewPanel({ values, requestType, urgency, signature, submitResult }) {
  return (
    <section className="review-panel">
      <div>
        <b>ตรวจสอบเรียบร้อย</b>
        <span>{requestType?.name} · {values.title} · {URGENCY.find((item) => item.id === urgency)?.label}</span>
      </div>
      <div className={signature ? 'ready' : 'missing'}>{signature ? 'มีลายเซ็นแล้ว' : 'ยังไม่มีลายเซ็น'}</div>
      {submitResult ? (
        <div className="result-box">
          <b>{submitResult.type === 'draft' ? 'บันทึกร่างแล้ว' : 'ส่งคำขอแล้ว'}</b>
          <span>{submitResult.data.request.request_no} · email mock: {submitResult.data.mock_email?.status || '-'}</span>
        </div>
      ) : null}
    </section>
  );
}

function FooterNav({ step, setStep, saveDraft, submit, canSend }) {
  return (
    <nav className="footer-nav">
      {step > 0 ? <button className="btn" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={18} />ย้อนกลับ</button> : <span />}
      <button className="btn quiet" onClick={saveDraft}><Save size={18} />บันทึกร่าง</button>
      <span className="footer-context">ขั้นตอน <b>{step + 1}</b> จาก {STEPS.length} · {STEPS[step].title}</span>
      {step < STEPS.length - 1 ? (
        <button className="btn primary" onClick={() => setStep((value) => value + 1)}>ถัดไป: {STEPS[step + 1].title}<ArrowRight size={18} /></button>
      ) : (
        <button className="btn send" disabled={!canSend} onClick={submit}><Send size={18} />ส่งคำขอ</button>
      )}
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

async function api(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`API ${path} failed`);
  return response.json();
}

createRoot(document.getElementById('root')).render(<App />);
