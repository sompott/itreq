import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { navigate } from '../lib/useHashRoute.js';
import { ChevronLeft, BarChart3, Calendar, Search, RotateCcw } from 'lucide-react';

const STATUS_LABEL = { completed: 'เสร็จสิ้น', closed: 'ปิดงาน' };
const STATUS_COLOR = { completed: 'green', closed: 'green' };
const URGENCY_LABEL = { low: 'ต่ำ', normal: 'ปกติ', high: 'เร่ง', urgent: 'ด่วน' };
const URGENCY_COLOR = { low: 'grey', normal: 'blue', high: 'yellow', urgent: 'red' };

const EMPTY_FILTER = {
  from: '', to: '', request_type_id: '', requester_emp_id: '',
  urgency: '', status: '', q: '',
};

export default function ReportsPage() {
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(EMPTY_FILTER);

  useEffect(() => {
    api('/request-types').then((d) => setTypes(d.request_types || d.items || d || []));
    reload(EMPTY_FILTER);
  }, []);

  async function reload(f = filter) {
    setLoading(true);
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
    const d = await api(`/admin/reports/completed${q.toString() ? '?' + q : ''}`);
    setItems(d.items || []);
    setLoading(false);
  }

  function reset() {
    setFilter(EMPTY_FILTER);
    reload(EMPTY_FILTER);
  }

  function set(key, value) { setFilter((s) => ({ ...s, [key]: value })); }

  const typeOptions = useMemo(() => (Array.isArray(types) ? types : []), [types]);

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn small quiet" onClick={() => navigate('/admin')}>
          <ChevronLeft size={16} /> กลับ
        </button>
        <h1><BarChart3 size={22} /> รายการคำขอที่สำเร็จแล้ว</h1>
      </div>

      <section className="card">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <label>
            <span><Calendar size={14} /> ตั้งแต่</span>
            <input type="date" value={filter.from} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label>
            <span><Calendar size={14} /> ถึง</span>
            <input type="date" value={filter.to} onChange={(e) => set('to', e.target.value)} />
          </label>
          <label>
            <span>ประเภทคำขอ</span>
            <select value={filter.request_type_id} onChange={(e) => set('request_type_id', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>ผู้ขอ (รหัสพนักงาน)</span>
            <input type="text" placeholder="เช่น 12345" value={filter.requester_emp_id}
                   onChange={(e) => set('requester_emp_id', e.target.value)} />
          </label>

          <label>
            <span>เร่งด่วน</span>
            <select value={filter.urgency} onChange={(e) => set('urgency', e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="low">ต่ำ</option>
              <option value="normal">ปกติ</option>
              <option value="high">เร่ง</option>
              <option value="urgent">ด่วน</option>
            </select>
          </label>
          <label>
            <span>สถานะ</span>
            <select value={filter.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">เสร็จสิ้น + ปิดงาน</option>
              <option value="completed">เฉพาะเสร็จสิ้น</option>
              <option value="closed">เฉพาะปิดงาน</option>
            </select>
          </label>
          <label style={{ gridColumn: 'span 2' }}>
            <span>ค้นหา (เลขที่ / หัวข้อ)</span>
            <input type="text" placeholder="พิมพ์คำค้นหา…" value={filter.q}
                   onChange={(e) => set('q', e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') reload(); }} />
          </label>

          <div style={{ gridColumn: 'span 4', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn small primary" onClick={() => reload()}>
              <Search size={14} /> ค้นหา
            </button>
            <button className="btn small quiet" onClick={reset}>
              <RotateCcw size={14} /> ล้างตัวกรอง
            </button>
            <span style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
              พบ {items.length} รายการ
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        {loading ? <p>กำลังโหลด…</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>หัวข้อ</th>
                <th>ประเภท</th>
                <th>ผู้ขอ</th>
                <th>เร่งด่วน</th>
                <th>สถานะ</th>
                <th>วันที่เสร็จ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/my/${r.id}`)} style={{ cursor: 'pointer' }}>
                  <td><b>{r.request_no}</b></td>
                  <td>{r.title}</td>
                  <td>{r.request_type_name}</td>
                  <td>{r.requester_emp_id}</td>
                  <td><span className={`pill ${URGENCY_COLOR[r.urgency] || 'grey'}`}>{URGENCY_LABEL[r.urgency] || r.urgency}</span></td>
                  <td><span className={`pill ${STATUS_COLOR[r.status] || 'green'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td>{formatDate(r.completed_at || r.created_at)}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>ไม่มีรายการตามเงื่อนไข</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('th-TH');
}
