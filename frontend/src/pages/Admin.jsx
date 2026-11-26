import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { fileToBase64 } from '../lib/fileBase64.js';
import { navigate } from '../lib/useHashRoute.js';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, ChevronLeft, Settings, BarChart3, FileText, Upload as UploadIcon, Search, Image as ImageIcon, Type as TypeIcon, Copy, Check, Download, Power, X } from 'lucide-react';

const FIELD_TYPES = [
  { id: 'text', label: 'ข้อความสั้น' },
  { id: 'textarea', label: 'ข้อความยาว' },
  { id: 'number', label: 'ตัวเลข' },
  { id: 'date', label: 'วันที่' },
  { id: 'email', label: 'อีเมล' },
  { id: 'dropdown', label: 'ตัวเลือก (เลือก 1)' },
  { id: 'radio', label: 'Radio' },
  { id: 'checkbox', label: 'Checkbox (เลือกหลาย)' },
  { id: 'file', label: 'ไฟล์แนบ' },
  { id: 'signature', label: 'ลายเซ็น' },
];
const FIELD_SOURCES = [
  { id: '', label: 'กรอกเอง' },
  { id: 'employees', label: 'เลือกข้อมูลพนักงานจากฐานข้อมูล' },
];
const EMPLOYEE_SOURCE_VALUES = [
  { id: 'name', label: 'ชื่อ-นามสกุล' },
  { id: 'badge_label', label: 'ป้ายชื่อ' },
  { id: 'emp_id', label: 'รหัสพนักงาน' },
  { id: 'position', label: 'ตำแหน่ง' },
  { id: 'department', label: 'แผนก' },
  { id: 'section', label: 'ส่วนงาน / Section' },
  { id: 'email', label: 'อีเมล' },
  { id: 'phone', label: 'เบอร์โทร' },
  { id: 'nickname', label: 'ชื่อเล่น' },
];
const FILL_STAGES = [
  { id: 'requester', label: 'ผู้ขอกรอกตอนสร้างคำขอ' },
  { id: 'it_after_approval', label: 'IT กรอกหลังเซ็นครบ' },
];

export default function AdminPage({ subPath }) {
  if (subPath?.startsWith('/types/')) {
    const id = Number(subPath.split('/')[2]);
    return <FormEditor requestTypeId={id} />;
  }
  return <RequestTypeList />;
}

function RequestTypeList() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState({ name: '', description: '' });

  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    const data = await api('/admin/request-types');
    setTypes(data.request_types || []);
    setLoading(false);
  }

  async function createType() {
    if (!newType.name.trim()) return;
    await api('/admin/request-types', {
      method: 'POST',
      body: JSON.stringify({ ...newType, sort_order: types.length + 1, is_active: 1 }),
    });
    setNewType({ name: '', description: '' });
    reload();
  }

  async function deactivateType(id) {
    if (!confirm('ปิดใช้งานประเภทคำขอนี้?')) return;
    await api(`/admin/request-types/${id}`, { method: 'DELETE' });
    reload();
  }

  async function permanentlyRemoveType(type) {
    const typedName = prompt(
      `ลบฟอร์ม “${type.name}” ถาวร?\n\nการลบจะย้อนกลับไม่ได้ กรุณาพิมพ์ชื่อฟอร์มเพื่อยืนยัน:`,
      '',
    );
    if (typedName === null) return;
    if (typedName.trim() !== type.name.trim()) {
      alert('ชื่อฟอร์มไม่ตรง จึงยังไม่ได้ลบ');
      return;
    }
    try {
      await api(`/admin/request-types/${type.id}/permanent`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      if (String(err.message).startsWith('request_type_in_use:')) {
        const count = String(err.message).split(':')[1] || '';
        alert(`ลบไม่ได้ เนื่องจากฟอร์มนี้มีคำขออ้างอิงอยู่ ${count} รายการ\nกรุณาใช้ปุ่ม “ปิด” แทน`);
        return;
      }
      alert(`ลบฟอร์มไม่สำเร็จ: ${err.message}`);
    }
  }

  async function activateType(id) {
    if (!confirm('เปิดใช้งานประเภทคำขอนี้อีกครั้ง?')) return;
    await api(`/admin/request-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: 1 }),
    });
    reload();
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1><Settings size={22} /> จัดการแบบฟอร์ม</h1>
        <p>สร้าง/แก้ฟอร์ม + ช่องเซ็นของแต่ละประเภทคำขอ</p>
        <button className="btn" onClick={() => navigate('/reports')} style={{ marginLeft: 'auto' }}>
          <BarChart3 size={16} /> ดูรายงาน
        </button>
      </div>

      <section className="card">
        <h2>สร้างประเภทคำขอใหม่</h2>
        <div className="form-row">
          <label>
            <span>ชื่อประเภท *</span>
            <input value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                   placeholder="เช่น ขอติดตั้งโปรแกรม" />
          </label>
          <label>
            <span>คำอธิบาย</span>
            <input value={newType.description} onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                   placeholder="คำอธิบายสั้น ๆ" />
          </label>
          <button className="btn primary" onClick={createType} disabled={!newType.name.trim()}>
            <Plus size={16} /> สร้าง
          </button>
        </div>
      </section>

      <section className="card">
        <h2>ประเภทคำขอทั้งหมด</h2>
        {loading ? <p>กำลังโหลด…</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>ชื่อ</th>
                <th>คำอธิบาย</th>
                <th style={{ width: 90 }}>สถานะ</th>
                <th style={{ width: 350 }}></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td><b>{t.name}</b></td>
                  <td>{t.description || '-'}</td>
                  <td>{t.is_active ? <span className="pill green">เปิด</span> : <span className="pill grey">ปิด</span>}</td>
                  <td className="request-type-actions">
                    <button className="btn small" onClick={() => navigate(`/admin/types/${t.id}`)}>
                      แก้ฟอร์ม
                    </button>
                    {t.is_active ? (
                      <button className="btn small" onClick={() => deactivateType(t.id)}>
                        <Power size={14} /> ปิด
                      </button>
                    ) : (
                      <button className="btn small" onClick={() => activateType(t.id)}>
                        <Power size={14} /> เปิดใช้งาน
                      </button>
                    )}
                    <button className="btn small danger" onClick={() => permanentlyRemoveType(t)}>
                      <Trash2 size={14} /> ลบฟอร์ม
                    </button>
                  </td>
                </tr>
              ))}
              {types.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>ยังไม่มีประเภทคำขอ</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function RequestNoConfigCard({ requestTypeId, initialConfig }) {
  const [config, setConfig] = useState(initialConfig || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!requestTypeId) return;
    api(`/admin/request-types/${requestTypeId}/request-no-config`)
      .then((d) => setConfig(d.config))
      .catch(() => setConfig({
        mode: 'legacy',
        pattern: 'REQ-{BYYYY}-{SEQ}',
        sequence_digits: 3,
        reset_period: 'year',
      }));
  }, [requestTypeId]);

  async function save() {
    setSaving(true);
    try {
      const result = await api(`/admin/request-types/${requestTypeId}/request-no-config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setConfig(result.config);
      alert('บันทึกการตั้งค่าเลขที่เอกสารแล้ว');
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!config) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>ตั้งค่าเลขที่เอกสาร</h2>
        <button className="btn small primary" onClick={save} disabled={saving}>
          <Save size={14} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>
      <div className="form-row doc-no-settings">
        <label>
          <span>รูปแบบการรันเลข</span>
          <select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value })}>
            <option value="legacy">ค่าเดิม: REQ-ปี-ลำดับ</option>
            <option value="custom">กำหนดเอง</option>
          </select>
        </label>
        <label>
          <span>Pattern</span>
          <input
            value={config.pattern}
            onChange={(e) => setConfig({ ...config, pattern: e.target.value })}
            placeholder="REQ-{BYYYY}-{SEQ}"
            disabled={config.mode !== 'custom'}
          />
          <small>ใช้ได้: {'{MM}'} เดือน, {'{SEQ}'} ลำดับ, {'{BYYYY}'} ปี พ.ศ. 4 หลัก, {'{BYY}'} ปี พ.ศ. 2 หลัก, {'{YY}'} ปี ค.ศ. 2 หลัก, {'{YYYY}'} ปี ค.ศ.</small>
          <small>
            ใช้ pattern นี้เฉพาะในระบบตั้งเลขเอกสารเท่านั้น ถ้าจะวางใน Word ให้ใช้ <code>{'{{request_no}}'}</code>
            ระบบจะนำเลขที่ที่สร้างจาก pattern นี้ไปกรอกให้เอง
          </small>
        </label>
        <label>
          <span>จำนวนหลักลำดับ</span>
          <input
            type="number"
            min="1"
            max="8"
            value={config.sequence_digits}
            onChange={(e) => setConfig({ ...config, sequence_digits: Number(e.target.value) })}
            disabled={config.mode !== 'custom'}
          />
        </label>
        <label>
          <span>เริ่มนับใหม่</span>
          <select
            value={config.reset_period}
            onChange={(e) => setConfig({ ...config, reset_period: e.target.value })}
            disabled={config.mode !== 'custom'}
          >
            <option value="month">ทุกเดือน</option>
            <option value="year">ทุกปี</option>
            <option value="never">ไม่รีเซ็ต</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function TemplateSection({ requestTypeId, typeRow, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [justUploaded, setJustUploaded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const hasTemplate = !!typeRow?.template_file;

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      alert('รองรับเฉพาะไฟล์ .docx เท่านั้น');
      return;
    }
    setUploading(true);
    setProgress(5);
    try {
      setProgress(15);
      const b64 = await fileToBase64(file);
      setProgress(45);
      await api(`/admin/request-types/${requestTypeId}/template`, {
        method: 'POST',
        body: JSON.stringify({ file_name: file.name, data_base64: b64 }),
      });
      setProgress(100);
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 4000);
      await onChanged();
    } catch (err) {
      alert(`อัปโหลดล้มเหลว: ${err.message}`);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }

  async function removeFile() {
    if (!confirm('ลบไฟล์ template?')) return;
    setRemoving(true);
    try {
      await api(`/admin/request-types/${requestTypeId}/template`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      alert(`ลบไม่สำเร็จ: ${err.message}`);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2><FileText size={18} /> Word Template สำหรับสร้างเอกสาร</h2>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>
        อัปโหลดไฟล์ <code>.docx</code> ที่มี placeholder รูปแบบ <code>{`{{ตัวแปร}}`}</code> สำหรับข้อความ
        และ <code>{`{{%ตัวแปร}}`}</code> สำหรับรูปภาพ (ลายเซ็น) —
        ผู้ใช้กดปุ่ม "ดาวน์โหลด Word" ที่หน้ารายละเอียดคำขอจะได้ไฟล์ที่เติมค่าให้แล้ว
      </p>

      {justUploaded ? (
        <div className="template-success">
          <Check size={16} /> อัปโหลดสำเร็จ — ระบบใช้ template ใหม่นี้แล้ว
        </div>
      ) : null}

      <div className="template-status">
        {hasTemplate ? (
          <div className="template-info has-file">
            <div className="template-info-icon"><FileText size={24} /></div>
            <div className="template-info-meta">
              <b>{typeRow.template_file}</b>
              <small>
                {typeRow.template_size ? `ขนาด ${formatBytes(typeRow.template_size)}` : ''}
                {typeRow.template_uploaded_at
                  ? ` · อัปโหลดเมื่อ ${new Date(typeRow.template_uploaded_at).toLocaleString('th-TH')}`
                  : ''}
              </small>
              <a className="template-info-link"
                 href={`/itrequest/api/request-types/${requestTypeId}/template`}
                 target="_blank" rel="noreferrer">
                <Download size={12} /> ดาวน์โหลดไฟล์ปัจจุบัน
              </a>
            </div>
            <div className="template-info-actions">
              <label className={`btn small ${uploading ? 'disabled' : ''}`}>
                <UploadIcon size={14} /> {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดใหม่'}
                <input type="file" accept=".docx" onChange={pickFile}
                       disabled={uploading || removing} style={{ display: 'none' }} />
              </label>
              <button className="btn small danger" onClick={removeFile}
                      disabled={uploading || removing}>
                <Trash2 size={14} /> {removing ? 'กำลังลบ…' : 'ลบ'}
              </button>
            </div>
          </div>
        ) : (
          <label className={`upload-zone ${uploading ? 'uploading' : ''}`}>
            <UploadIcon size={28} />
            <b>{uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดไฟล์ .docx'}</b>
            <small>{uploading ? 'กรุณารอสักครู่' : 'ลาก-วาง หรือคลิกเลือกไฟล์'}</small>
            <input type="file" accept=".docx" onChange={pickFile}
                   disabled={uploading} style={{ display: 'none' }} />
          </label>
        )}

        {uploading ? (
          <div className="template-progress">
            <div className="template-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatBytes(n) {
  if (!n || n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const REQUESTER_VARS = [
  ['requester_name', 'ชื่อ-นามสกุล'],
  ['requester_first_name', 'ชื่อ'],
  ['requester_last_name', 'นามสกุล'],
  ['requester_nickname', 'ชื่อเล่น'],
  ['requester_position', 'ตำแหน่ง'],
  ['requester_department', 'แผนก'],
  ['requester_section', 'กลุ่ม / Section'],
  ['requester_email', 'อีเมล'],
  ['requester_phone', 'เบอร์โทร'],
  ['requester_emp_id', 'รหัสพนักงาน'],
  ['requester_signature', 'ลายเซ็น', true],
  ['requester_picture', 'รูปประจำตัว', true],
];
const DOC_VARS = [
  ['request_no', 'เลขที่คำขอ'],
  ['request_type', 'ประเภทคำขอ'],
  ['title', 'หัวข้อ'],
  ['detail', 'รายละเอียด'],
  ['urgency', 'ความเร่งด่วน'],
  ['status', 'สถานะ'],
  ['created_date', 'วันที่สร้าง'],
  ['submitted_date', 'วันที่ส่ง'],
];
const APPROVER_FIELD_DEFS = [
  ['slot_label', 'ชื่อช่องเซ็น'],
  ['name', 'ชื่อ-นามสกุล'],
  ['position', 'ตำแหน่ง'],
  ['department', 'แผนก'],
  ['section', 'กลุ่ม / Section'],
  ['email', 'อีเมล'],
  ['phone', 'เบอร์โทร'],
  ['emp_id', 'รหัสพนักงาน'],
  ['nickname', 'ชื่อเล่น'],
  ['signed_at', 'วันที่เซ็น'],
  ['comment', 'หมายเหตุการอนุมัติ'],
  ['status', 'สถานะ'],
  ['signature', 'ลายเซ็น', true],
];

function buildVariableGroups({ fields, slots }) {
  const groups = [
    { id: 'doc', label: 'ข้อมูลคำขอ', vars: DOC_VARS },
    { id: 'requester', label: 'ผู้ขอ', vars: REQUESTER_VARS },
    ...[
      ['acceptance', 'IT ลงนามรับงาน'],
      ['completion', 'IT ลงนามยืนยันงานเสร็จ'],
    ].map(([phase, label]) => ({
      id: `it_${phase}`, label,
      vars: [
        [`it_${phase}_name`, 'ชื่อผู้เซ็น'],
        [`it_${phase}_emp_id`, 'รหัสพนักงาน'],
        [`it_${phase}_signed_at`, 'วันที่เซ็น'],
        [`it_${phase}_comment`, 'หมายเหตุ'],
        [`it_${phase}_signature`, 'ลายเซ็น', true],
      ],
    })),
  ];
  const formVars = (fields || [])
    .filter((f) => f.field_name)
    .map((f) => [
      f.field_name,
      `${f.field_label || '-'} (${f.field_type})`,
      f.field_type === 'signature' || f.field_type === 'file',
    ]);
  if (formVars.length) {
    groups.push({ id: 'form', label: 'ฟิลด์ในฟอร์มนี้', vars: formVars });
  }

  // ฟิลด์ checkbox / radio / dropdown — สร้างตัวแปรย่อยต่อ option
  // ใช้ใน Word เพื่อเช็คทีละช่อง เช่น [{{hardware_usb}}] USB → [✓] USB
  const perOptionVars = [];
  for (const f of fields || []) {
    if (!f.field_name) continue;
    if (!['checkbox', 'radio', 'dropdown'].includes(f.field_type)) continue;
    const opts = Array.isArray(f.options) ? f.options : [];
    for (const opt of opts) {
      const slug = slugifyOptionClient(opt);
      perOptionVars.push([
        `check_${f.field_name}_${slug}`,
        `${f.field_label || f.field_name}: "${opt}" (✓ ถ้าเลือก)`,
      ]);
    }
    if (f.validation?.allow_other) {
      perOptionVars.push([
        `check_${f.field_name}_other`,
        `${f.field_label || f.field_name}: “อื่น ๆ” (✓ ถ้าเลือก)`,
      ]);
      perOptionVars.push([
        `${f.field_name}_other_text`,
        `${f.field_label || f.field_name}: รายละเอียดที่กรอกใน “อื่น ๆ”`,
      ]);
    }
  }
  if (perOptionVars.length) {
    groups.push({
      id: 'options',
      label: 'ตัวเลือก Checkbox/Radio (ทีละช่อง)',
      vars: perOptionVars,
    });
  }
  (slots || []).forEach((slot, idx) => {
    const n = slot.step_no || idx + 1;
    groups.push({
      id: `approver-${n}`,
      label: `ผู้อนุมัติ #${n}${slot.slot_label ? ` · ${slot.slot_label}` : ''}`,
      vars: APPROVER_FIELD_DEFS.map(([key, label, isImg]) => [`approver_${n}_${key}`, label, isImg]),
    });
  });
  return groups;
}

function tokenFor([key, , isImg]) {
  return isImg ? `{{%${key}}}` : `{{${key}}}`;
}

// ต้องตรงกับ slugifyOption() ฝั่ง server (server/index.js)
function slugifyOptionClient(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\w฀-๿]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function TemplateVariablesGuide({ fields, slots }) {
  const groups = useMemo(() => buildVariableGroups({ fields, slots }), [fields, slots]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(groups[0]?.id || null);
  const [copiedToken, setCopiedToken] = useState(null);

  function copy(token) {
    navigator.clipboard?.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken((cur) => (cur === token ? null : cur)), 1200);
  }

  function filterVars(vars) {
    const q = query.trim().toLowerCase();
    if (!q) return vars;
    return vars.filter(([key, label]) =>
      key.toLowerCase().includes(q) || (label || '').toLowerCase().includes(q),
    );
  }

  // เมื่อค้นหา — แสดงทุกกลุ่มที่มีผลลัพธ์
  const isSearching = query.trim().length > 0;
  const visibleGroups = isSearching
    ? groups.map((g) => ({ ...g, vars: filterVars(g.vars) })).filter((g) => g.vars.length)
    : groups.filter((g) => g.id === activeId);

  const totalCount = groups.reduce((sum, g) => sum + g.vars.length, 0);
  const matchCount = isSearching
    ? visibleGroups.reduce((sum, g) => sum + g.vars.length, 0)
    : null;

  return (
    <section className="card template-vars-card">
      <div className="card-head" style={{ alignItems: 'center' }}>
        <h2><FileText size={18} /> ตัวแปรที่ใช้ได้ใน Word Template</h2>
        <small style={{ color: 'var(--muted)', marginLeft: 8 }}>
          {isSearching ? `พบ ${matchCount} / ${totalCount}` : `${totalCount} ตัวแปร`}
        </small>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
        คลิกการ์ดเพื่อ <b>คัดลอก</b> แล้ววางในไฟล์ <code>.docx</code> —
        <TypeIcon size={11} style={{ verticalAlign: '-1px' }} /> ข้อความ <code>{`{{...}}`}</code>
        &nbsp;·&nbsp;
        <ImageIcon size={11} style={{ verticalAlign: '-1px' }} /> รูปภาพ <code>{`{{%...}}`}</code>
      </p>

      <div className="template-vars-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาตัวแปร เช่น 'ตำแหน่ง', 'position', 'approver_1'"
        />
        {query ? (
          <button className="link" onClick={() => setQuery('')}>ล้าง</button>
        ) : null}
      </div>

      {!isSearching && groups.length > 1 ? (
        <div className="template-vars-tabs">
          {groups.map((g) => (
            <button key={g.id} type="button"
                    className={`tv-tab ${activeId === g.id ? 'active' : ''}`}
                    onClick={() => setActiveId(g.id)}>
              {g.label}
              <span className="tv-tab-count">{g.vars.length}</span>
            </button>
          ))}
        </div>
      ) : null}

      {visibleGroups.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          ไม่พบตัวแปรที่ตรงกับ "{query}"
        </p>
      ) : null}

      {visibleGroups.map((g) => (
        <div key={g.id} className="template-vars-group">
          {isSearching ? (
            <h4 style={{ margin: '12px 0 8px', fontSize: 13, color: 'var(--muted)' }}>
              {g.label} <small>({g.vars.length})</small>
            </h4>
          ) : null}
          <PlaceholderGrid items={g.vars} copiedToken={copiedToken} onCopy={copy} />
        </div>
      ))}

      {(!slots || slots.length === 0) && !isSearching && activeId === 'doc' ? null : null}
    </section>
  );
}

function PlaceholderGrid({ items, copiedToken, onCopy }) {
  return (
    <div className="placeholder-grid">
      {items.map((item) => {
        const [key, label, isImg] = item;
        const token = tokenFor(item);
        const isCopied = copiedToken === token;
        return (
          <button key={key} type="button"
                  className={`placeholder-chip ${isCopied ? 'copied' : ''} ${isImg ? 'is-image' : ''}`}
                  onClick={() => onCopy(token)} title="คลิกเพื่อคัดลอก">
            <span className="placeholder-chip-head">
              {isImg ? <ImageIcon size={12} /> : <TypeIcon size={12} />}
              <code>{token}</code>
              <span className="placeholder-chip-copy">
                {isCopied ? <><Check size={12} /> คัดลอกแล้ว</> : <Copy size={12} />}
              </span>
            </span>
            <small>{label}</small>
          </button>
        );
      })}
    </div>
  );
}

function FormEditor({ requestTypeId }) {
  const [design, setDesign] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { reload(); }, [requestTypeId]);

  async function reload() {
    const data = await api(`/admin/request-types/${requestTypeId}/design`);
    setDesign({
      ...data,
      fields: data.fields || [],
      slots: (data.slots || []).map((s) => ({ ...s })),
    });
  }

  if (!design) return <div className="page"><p>กำลังโหลด…</p></div>;

  function patchField(idx, patch) {
    setDesign((d) => ({
      ...d,
      fields: d.fields.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }));
  }
  function patchFieldValidation(idx, patch) {
    setDesign((d) => ({
      ...d,
      fields: d.fields.map((f, i) => {
        if (i !== idx) return f;
        const validation = { ...(f.validation || {}), ...patch };
        Object.keys(validation).forEach((key) => {
          if (validation[key] === '' || validation[key] === null || validation[key] === undefined) {
            delete validation[key];
          }
        });
        return { ...f, validation };
      }),
    }));
  }
  function addField() {
    setDesign((d) => ({
      ...d,
      fields: [...d.fields, {
        field_label: '', field_name: '', field_type: 'text',
        is_required: false, sort_order: d.fields.length + 1, options: null,
        validation: { fill_stage: 'requester' },
      }],
    }));
  }
  function removeField(idx) {
    setDesign((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== idx) }));
  }
  function moveField(idx, dir) {
    const next = [...design.fields];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDesign((d) => ({ ...d, fields: next }));
  }

  function patchSlot(idx, patch) {
    setDesign((d) => ({
      ...d,
      slots: d.slots.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  }
  function addSlot() {
    setDesign((d) => ({
      ...d,
      slots: [...d.slots, {
        step_no: d.slots.length + 1, slot_label: '', mode: 'selectable',
        fixed_emp_id: null, is_required: true, allow_skip: false,
        sign_stage: 'approval',
      }],
    }));
  }
  function removeSlot(idx) {
    setDesign((d) => ({ ...d, slots: d.slots.filter((_, i) => i !== idx) }));
  }
  function moveSlot(idx, dir) {
    const next = [...design.slots];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDesign((d) => ({ ...d, slots: next.map((s, i) => ({ ...s, step_no: i + 1 })) }));
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await api(`/admin/request-types/${requestTypeId}/design`, {
        method: 'PUT',
        body: JSON.stringify({
          name: design.form?.name || `ฟอร์ม ${design.request_type.name}`,
          fields: design.fields,
          slots: design.slots,
        }),
      });
      const slotsMatch = saved.slots?.length === design.slots.length
        && design.slots.every((slot, index) => {
          const stored = saved.slots[index];
          return stored?.mode === slot.mode
            && (stored.sign_stage || 'approval') === (slot.sign_stage || 'approval');
        });
      if (!slotsMatch) {
        throw new Error('ช่วงเซ็นหรือโหมดผู้เซ็นที่บันทึกไม่ตรง กรุณาตรวจว่า backend ใช้เวอร์ชันล่าสุด');
      }
      alert('บันทึกแล้ว');
      await reload();
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn small quiet" onClick={() => navigate('/admin')}><ChevronLeft size={16} /> กลับ</button>
        <h1>แก้ฟอร์ม: {design.request_type.name}</h1>
      </div>

      <RequestNoConfigCard requestTypeId={requestTypeId} initialConfig={design.request_no_config} />

      <TemplateSection requestTypeId={requestTypeId} typeRow={design.request_type} onChanged={reload} />

      <TemplateVariablesGuide fields={design.fields} slots={design.slots} />

      <section className="card">
        <div className="card-head">
          <h2>ฟิลด์ในฟอร์ม</h2>
          <button className="btn small" onClick={addField}><Plus size={14} /> เพิ่มฟิลด์</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>ลำดับ</th>
              <th>ป้ายชื่อ</th>
              <th>ชื่อตัวแปร <small>(ใช้ใน Word)</small></th>
              <th style={{ width: 140 }}>ประเภท</th>
              <th style={{ width: 170 }}>แหล่งข้อมูล</th>
              <th style={{ width: 160 }}>ค่าที่นำไปกรอก</th>
              <th style={{ width: 150 }}>เชื่อมข้อมูล</th>
              <th style={{ width: 190 }}>บทบาท/ขั้นตอนผู้กรอก</th>
              <th>ตัวเลือก (dropdown/radio/checkbox)</th>
              <th style={{ width: 70 }}>บังคับ</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {design.fields.map((f, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>
                  <input value={f.field_label} onChange={(e) => patchField(idx, { field_label: e.target.value })}
                         placeholder="หัวข้อ" />
                </td>
                <td>
                  <input value={f.field_name} onChange={(e) => patchField(idx, { field_name: e.target.value })}
                         placeholder="title" />
                </td>
                <td>
                  <select value={f.field_type} onChange={(e) => patchField(idx, { field_type: e.target.value })}>
                    {FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={f.validation?.source || ''}
                    onChange={(e) => patchFieldValidation(idx, {
                      source: e.target.value,
                      source_value: e.target.value === 'employees' ? (f.validation?.source_value || 'name') : '',
                      employee_linked: e.target.value === 'employees' ? f.validation?.employee_linked : '',
                      employee_link_group: e.target.value === 'employees' ? f.validation?.employee_link_group : '',
                    })}
                    disabled={!['text', 'dropdown'].includes(f.field_type)}
                  >
                    {FIELD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={f.validation?.source_value || 'name'}
                    onChange={(e) => patchFieldValidation(idx, { source_value: e.target.value })}
                    disabled={f.validation?.source !== 'employees'}
                  >
                    {EMPLOYEE_SOURCE_VALUES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
                <td>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={!!f.validation?.employee_linked}
                        disabled={f.validation?.source !== 'employees'}
                        onChange={(e) => patchFieldValidation(idx, {
                          employee_linked: e.target.checked ? true : '',
                          employee_link_group: e.target.checked ? (f.validation?.employee_link_group || '') : '',
                        })}
                        title="เลือกพนักงานครั้งเดียวแล้วเติม field พนักงานอื่นที่ติ๊กเชื่อมไว้ด้วย"
                      />
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>เปิด</span>
                    </label>
                    <input
                      value={f.validation?.employee_link_group || ''}
                      onChange={(e) => patchFieldValidation(idx, { employee_link_group: e.target.value })}
                      disabled={f.validation?.source !== 'employees' || !f.validation?.employee_linked}
                      placeholder="กลุ่ม เช่น person1"
                      title="ใช้ชื่อกลุ่มเดียวกันสำหรับช่องของพนักงานคนเดียวกัน เช่น person1, person2"
                    />
                  </div>
                </td>
                <td>
                  <select
                    value={f.validation?.fill_stage || 'requester'}
                    onChange={(e) => patchFieldValidation(idx, { fill_stage: e.target.value })}
                  >
                    {FILL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
                <td>
                  {['dropdown', 'radio', 'checkbox'].includes(f.field_type) ? (
                    <FieldOptionsEditor
                      options={Array.isArray(f.options) ? f.options : []}
                      allowOther={!!f.validation?.allow_other}
                      onOptionsChange={(options) => patchField(idx, { options })}
                      onAllowOtherChange={(checked) => patchFieldValidation(idx, { allow_other: checked ? true : '' })}
                    />
                  ) : <span style={{ color: '#bbb' }}>—</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!f.is_required}
                         onChange={(e) => patchField(idx, { is_required: e.target.checked })} />
                </td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => moveField(idx, -1)} title="เลื่อนขึ้น"><ArrowUp size={14} /></button>
                  <button className="icon-btn" onClick={() => moveField(idx, 1)} title="เลื่อนลง"><ArrowDown size={14} /></button>
                  <button className="icon-btn danger" onClick={() => removeField(idx)} title="ลบ"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {design.fields.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', color: '#888' }}>ยังไม่มีฟิลด์ — กด "เพิ่มฟิลด์" ด้านบน</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>ช่องเซ็นอนุมัติ <small style={{ color: 'var(--muted)', fontWeight: 'normal', fontSize: 13 }}>— ลำดับ = ลำดับการส่งอีเมล (เซ็นทีละขั้น)</small></h2>
          <button className="btn small" onClick={addSlot}><Plus size={14} /> เพิ่มช่อง</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>
          เลือกช่วงเซ็นของแต่ละช่อง: อนุมัติคำขอ / ก่อนเริ่มดำเนินงาน / ก่อนปิดงาน
          ระบบจะส่งอีเมล <b>ทีละขั้นภายในช่วงนั้น</b> เมื่อถึงช่วงเซ็นแล้ว ใช้ปุ่ม ▲ ▼ ทางขวาเพื่อจัดลำดับ
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ลำดับ</th>
              <th>ชื่อช่อง</th>
              <th style={{ width: 200 }}>ช่วงเซ็น</th>
              <th style={{ width: 160 }}>โหมด</th>
              <th>รหัสพนักงาน (fix)</th>
              <th style={{ width: 70 }}>บังคับ</th>
              <th style={{ width: 70 }}>ข้ามได้</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {design.slots.map((s, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>
                  <input value={s.slot_label} onChange={(e) => patchSlot(idx, { slot_label: e.target.value })}
                         placeholder="หัวหน้าแผนก" />
                </td>
                <td>
                  <select value={s.sign_stage || 'approval'} onChange={(e) => {
                    const sign_stage = e.target.value;
                    patchSlot(idx, { sign_stage, ...(s.mode === 'self' && sign_stage !== 'approval' ? { mode: 'it_staff' } : {}) });
                  }}>
                    <option value="approval">อนุมัติคำขอ</option>
                    <option value="acceptance">หลังอนุมัติ ก่อนเริ่มงาน</option>
                    <option value="completion">งานเสร็จ ก่อนปิดงาน</option>
                  </select>
                </td>
                <td>
                  <select value={s.mode} onChange={(e) => patchSlot(idx, { mode: e.target.value })}>
                    <option value="fixed">🔒 กำหนดตายตัว</option>
                    <option value="selectable">✏️ ผู้ขอเลือก</option>
                    {(s.sign_stage || 'approval') === 'approval' ? <option value="self">👤 ผู้ขอเซ็นเอง</option> : null}
                    <option value="it_staff">🛠️ เจ้าหน้าที่ IT ลงนาม</option>
                  </select>
                </td>
                <td>
                  {s.mode === 'fixed' ? (
                    <input value={s.fixed_emp_id || ''} onChange={(e) => patchSlot(idx, { fixed_emp_id: e.target.value })}
                           placeholder="emp_code เช่น 021093" />
                  ) : s.mode === 'self' ? (
                    <span style={{ color: '#888', fontSize: 12 }}>(ผู้ขอเอง — auto)</span>
                  ) : s.mode === 'it_staff' ? <span style={{ color: '#888', fontSize: 12 }}>เจ้าหน้าที่ IT ลงนามเมื่อถึงช่วง</span> : <span style={{ color: '#bbb' }}>—</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!s.is_required}
                         onChange={(e) => patchSlot(idx, { is_required: e.target.checked })} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!s.allow_skip}
                         onChange={(e) => patchSlot(idx, { allow_skip: e.target.checked })} />
                </td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => moveSlot(idx, -1)}><ArrowUp size={14} /></button>
                  <button className="icon-btn" onClick={() => moveSlot(idx, 1)}><ArrowDown size={14} /></button>
                  <button className="icon-btn danger" onClick={() => removeSlot(idx)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {design.slots.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>ยังไม่มีช่องเซ็น — กด "เพิ่มช่อง" ด้านบน</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="sticky-actions">
        <button className="btn primary" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'กำลังบันทึก…' : 'บันทึกฟอร์ม'}
        </button>
      </div>
    </div>
  );
}

function FieldOptionsEditor({ options, allowOther, onOptionsChange, onAllowOtherChange }) {
  const [draft, setDraft] = useState('');

  function addOptions() {
    const incoming = draft.split(',').map((value) => value.trim()).filter(Boolean);
    if (!incoming.length) return;
    const existing = new Set(options.map((value) => String(value).toLocaleLowerCase('th-TH')));
    const unique = incoming.filter((value) => {
      const key = value.toLocaleLowerCase('th-TH');
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (unique.length) onOptionsChange([...options, ...unique]);
    setDraft('');
  }

  return (
    <div className="field-options-editor">
      <div className="option-composer">
        <input
          value={draft}
          placeholder="พิมพ์ตัวเลือก เช่น PC"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOptions();
            }
          }}
        />
        <button type="button" className="btn small" onClick={addOptions} disabled={!draft.trim()}>
          <Plus size={13} /> เพิ่ม
        </button>
      </div>
      {options.length ? (
        <div className="option-chip-list">
          {options.map((option, optionIndex) => (
            <span className="option-chip" key={`${option}-${optionIndex}`}>
              {option}
              <button
                type="button"
                onClick={() => onOptionsChange(options.filter((_, index) => index !== optionIndex))}
                aria-label={`ลบตัวเลือก ${option}`}
                title="ลบตัวเลือก"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : <small className="option-empty">ยังไม่มีตัวเลือก</small>}
      <label>
        <input
          type="checkbox"
          checked={allowOther}
          onChange={(e) => onAllowOtherChange(e.target.checked)}
        />
        มี “อื่น ๆ” พร้อมช่องกรอก
      </label>
    </div>
  );
}
