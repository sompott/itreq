import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CalendarDays, ChevronLeft, Download, RotateCcw, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { navigate } from '../lib/useHashRoute.js';

const EMPTY_FILTERS = {
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  type: '',
  provider: '',
};

export default function ITServicesReportPage() {
  const [types, setTypes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/it-services/types').then((d) => setTypes(d.types || [])).catch(() => setTypes([]));
    api('/it-services/employees?scope=it&q=').then((d) => setProviders(d.employees || [])).catch(() => setProviders([]));
    loadReport(EMPTY_FILTERS);
  }, []);

  const summary = useMemo(() => ({
    total: items.length,
    overwork: items.filter((item) => item.overwork).length,
    providers: new Set(items.map((item) => item.service_provider).filter(Boolean)).size,
  }), [items]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setDateRange(range) {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    if (range === 'thisMonth') start.setDate(1);
    if (range === 'lastMonth') {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    }
    if (range === 'thisYear') {
      start.setMonth(0, 1);
    }
    if (range === 'lastYear') {
      start.setFullYear(start.getFullYear() - 1, 0, 1);
      end.setFullYear(end.getFullYear() - 1, 11, 31);
    }
    setFilters((current) => ({
      ...current,
      start_date: toInputDate(start),
      end_date: toInputDate(end),
    }));
  }

  function setShift(shift) {
    const times = {
      allday: ['', ''],
      day: ['08:00', '20:00'],
      night: ['20:00', '08:00'],
    }[shift] || ['', ''];
    setFilters((current) => ({ ...current, start_time: times[0], end_time: times[1] }));
  }

  async function loadReport(nextFilters = filters) {
    if (Boolean(nextFilters.start_date) !== Boolean(nextFilters.end_date)) {
      setError('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุดให้ครบ');
      return;
    }
    if (Boolean(nextFilters.start_time) !== Boolean(nextFilters.end_time)) {
      setError('กรุณาระบุเวลาเริ่มต้นและเวลาสิ้นสุดให้ครบ');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      params.set('limit', '1000');
      const data = await api(`/it-services/report?${params.toString()}`);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || 'โหลดรายงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    loadReport(EMPTY_FILTERS);
  }

  function exportCsv() {
    const header = ['งานที่', 'วันที่แจ้ง', 'วันที่รับงาน', 'วันที่ปิดงาน', 'ประเภทงาน', 'รายละเอียด', 'ผู้ปฏิบัติงาน', 'ผู้ร้องขอ', 'สาเหตุ', 'รายละเอียดการแก้ไข', 'สถานะ'];
    const rows = items.map((item) => [
      item.id,
      item.date_start,
      item.datetime_job,
      item.date_end,
      item.type,
      item.details,
      item.provider_name || item.service_provider,
      item.applicant_name || item.service_applicant,
      item.cause_job,
      item.details_job,
      item.status ? 'ปฏิบัติงานสำเร็จ' : 'ยังไม่ปฏิบัติงาน',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ITService_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page it-services-page">
      <div className="page-head split">
        <div>
          <button className="btn small quiet" onClick={() => navigate('/it-services')}>
            <ChevronLeft size={16} /> กลับ IT Services
          </button>
          <h1><BarChart3 size={22} /> รายงาน IT Services</h1>
          <p>รายงานงานที่ปิดแล้วจากฐานข้อมูล IT Services เดิม</p>
        </div>
        <button className="btn primary" onClick={exportCsv} disabled={!items.length}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <section className="metric-row">
        <Metric label="พบรายการ" value={summary.total} />
        <Metric label="งานข้ามวัน" value={summary.overwork} />
        <Metric label="ผู้ให้บริการ" value={summary.providers} />
        <Metric label="จำกัดผลลัพธ์" value="1000" />
      </section>

      <section className="card report-filter-card">
        <div className="report-quick-row">
          <div>
            <span className="section-subtitle">ช่วงวันที่ด่วน</span>
            <div className="action-row">
              <button className="btn small" onClick={() => setDateRange('thisMonth')}>เดือนนี้</button>
              <button className="btn small" onClick={() => setDateRange('lastMonth')}>เดือนที่แล้ว</button>
              <button className="btn small" onClick={() => setDateRange('thisYear')}>ปีนี้</button>
              <button className="btn small" onClick={() => setDateRange('lastYear')}>ปีที่แล้ว</button>
            </div>
          </div>
          <div>
            <span className="section-subtitle">ช่วงเวลาด่วน</span>
            <div className="action-row">
              <button className="btn small" onClick={() => setShift('allday')}>ทั้งวัน</button>
              <button className="btn small" onClick={() => setShift('day')}>กะกลางวัน 08-20</button>
              <button className="btn small" onClick={() => setShift('night')}>กะกลางคืน 20-08</button>
            </div>
          </div>
        </div>

        <div className="report-filters detailed">
          <label className="field">
            <span><CalendarDays size={14} /> วันเริ่มต้น</span>
            <input type="date" value={filters.start_date} onChange={(e) => updateFilter('start_date', e.target.value)} />
          </label>
          <label className="field">
            <span><CalendarDays size={14} /> วันสิ้นสุด</span>
            <input type="date" value={filters.end_date} onChange={(e) => updateFilter('end_date', e.target.value)} />
          </label>
          <label className="field">
            <span>เวลาเริ่ม</span>
            <input type="time" value={filters.start_time} onChange={(e) => updateFilter('start_time', e.target.value)} />
          </label>
          <label className="field">
            <span>เวลาสิ้นสุด</span>
            <input type="time" value={filters.end_time} onChange={(e) => updateFilter('end_time', e.target.value)} />
          </label>
          <label className="field">
            <span>ประเภทงาน</span>
            <select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
              <option value="">ทุกประเภทงาน</option>
              {types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="field">
            <span>ผู้ให้บริการ</span>
            <select value={filters.provider} onChange={(e) => updateFilter('provider', e.target.value)}>
              <option value="">ผู้ให้บริการทั้งหมด</option>
              {providers.map((provider) => (
                <option key={provider.emp_id} value={provider.emp_id}>{provider.label}</option>
              ))}
            </select>
          </label>
          <div className="report-filter-actions">
            <button className="btn primary" onClick={() => loadReport()} disabled={loading}>
              <Search size={16} /> ค้นหา
            </button>
            <button className="btn" onClick={clearFilters} disabled={loading}>
              <RotateCcw size={16} /> ล้างค่า
            </button>
          </div>
        </div>

        {error ? <div className="inline-error"><AlertCircle size={16} /> {error}</div> : null}
      </section>

      <section className="card report-results-card">
        <div className="table-toolbar">
          <h2 className="section-title">ผลรายงาน</h2>
          <span className="section-subtitle">พบ {items.length} รายการ</span>
        </div>
        {loading ? <p className="muted">กำลังโหลด...</p> : (
          <div className="table-scroll">
            <table className="data-table report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ประเภทงาน</th>
                  <th>รายละเอียด</th>
                  <th>ผู้ปฏิบัติงาน</th>
                  <th>ผู้ร้องขอ</th>
                  <th>วันที่แจ้ง</th>
                  <th>วันที่รับงาน</th>
                  <th>วันที่ปิดงาน</th>
                  <th>การแก้ไข</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.id}</b></td>
                    <td>{item.type}</td>
                    <td className="report-detail-cell">{item.details}</td>
                    <td>{item.provider_name || item.service_provider}</td>
                    <td>{item.applicant_name || item.service_applicant}</td>
                    <td>{item.date_start || '-'}</td>
                    <td>{item.datetime_job || '-'}</td>
                    <td>{item.date_end || '-'}</td>
                    <td>
                      <small>{item.cause_job || '-'}</small>
                      <small className="row-subtext">{item.details_job || '-'}</small>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="empty-cell">ไม่พบรายการรายงาน</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
