import { itServiceDB, itServiceEmpDB } from '../db.js';

function ensureItServiceDB() {
  if (!itServiceDB) {
    throw Object.assign(new Error('it_service_db_not_configured'), { httpStatus: 503 });
  }
}

function ensureEmpDB() {
  if (!itServiceEmpDB) {
    throw Object.assign(new Error('it_service_emp_db_not_configured'), { httpStatus: 503 });
  }
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: Number(row.ID),
    type: row.Type,
    details: row.Details,
    service_applicant: row.ServiceApplicant,
    service_provider: row.ServiceProvider,
    applicant_name: row.fullServiceApplicant || row.applicant_name || null,
    provider_name: row.fullServiceProvider || row.provider_name || null,
    datetime_job: row.datetimeJob || null,
    acknowledge: Number(row.acknowledge || row.Acknowledge || 0),
    overwork: Number(row.Overwork || 0),
    overwork_details: row.overworkDetails || '',
    status: Number(row.Status || 0),
    date_start: row.dateS || row.DateS || null,
    date_end: row.DateE || null,
    cause_job: row.Causejob || '',
    details_job: row.DetailsJob || '',
    data_ack: row.Dataack || '',
    coadjutor1: row.coadjutor1 || '',
    coadjutor2: row.coadjutor2 || '',
  };
}

export async function listServiceTypes() {
  ensureItServiceDB();
  const [rows] = await itServiceDB.query(
    'SELECT I_TypeName AS name FROM iso_servicetype ORDER BY I_TypeName',
  );
  return rows.map((r) => r.name).filter(Boolean);
}

export async function listServiceTypeRecords() {
  ensureItServiceDB();
  const [rows] = await itServiceDB.query(
    'SELECT I_ID AS id, I_Sort AS sort, I_TypeName AS name FROM iso_servicetype ORDER BY I_Sort, I_TypeName',
  );
  return rows.map((row) => ({ id: Number(row.id), sort: Number(row.sort || 0), name: row.name }));
}

export async function createServiceType(name) {
  ensureItServiceDB();
  const clean = String(name || '').trim();
  if (!clean) throw Object.assign(new Error('type_name_required'), { httpStatus: 400 });
  const [dup] = await itServiceDB.query('SELECT COUNT(*) AS total FROM iso_servicetype WHERE I_TypeName = ?', [clean]);
  if (Number(dup[0]?.total || 0) > 0) throw Object.assign(new Error('type_name_duplicate'), { httpStatus: 409 });
  const [sortRows] = await itServiceDB.query('SELECT COALESCE(MAX(I_Sort), 0) + 1 AS next_sort FROM iso_servicetype');
  const [result] = await itServiceDB.query(
    'INSERT INTO iso_servicetype (I_Sort, I_TypeName) VALUES (?, ?)',
    [Number(sortRows[0]?.next_sort || 1), clean],
  );
  return { id: result.insertId, name: clean };
}

export async function updateServiceType(id, name) {
  ensureItServiceDB();
  const clean = String(name || '').trim();
  if (!clean) throw Object.assign(new Error('type_name_required'), { httpStatus: 400 });
  const [dup] = await itServiceDB.query(
    'SELECT COUNT(*) AS total FROM iso_servicetype WHERE I_TypeName = ? AND I_ID <> ?',
    [clean, id],
  );
  if (Number(dup[0]?.total || 0) > 0) throw Object.assign(new Error('type_name_duplicate'), { httpStatus: 409 });
  await itServiceDB.query('UPDATE iso_servicetype SET I_TypeName = ? WHERE I_ID = ?', [clean, id]);
  return { id: Number(id), name: clean };
}

export async function deleteServiceType(id) {
  ensureItServiceDB();
  await itServiceDB.query('DELETE FROM iso_servicetype WHERE I_ID = ?', [id]);
}

export async function searchServiceEmployees({ q = '', itOnly = false } = {}) {
  ensureEmpDB();
  const keyword = String(q || '').trim();
  const like = `%${keyword}%`;
  const deptClause = itOnly ? "AND emp_dept_id = '7'" : '';
  const [rows] = await itServiceEmpDB.query(
    `SELECT emp_code AS emp_id,
            CONCAT(emp_code, ' ', emp_profix, emp_name, ' ', emp_lastname,
                   ' : ', IFNULL(NULLIF(emp_nickname, ''), '-')) AS label,
            TRIM(CONCAT_WS(' ', NULLIF(emp_profix,''), emp_name, emp_lastname)) AS name,
            emp_nickname AS nickname,
            emp_department AS department,
            emp_dept_id AS dept_id
       FROM psweb2_employee
      WHERE emp_status != '0'
        ${deptClause}
        AND (? = '' OR emp_code LIKE ? OR emp_name LIKE ? OR emp_lastname LIKE ? OR emp_nickname LIKE ?)
      ORDER BY emp_name, emp_lastname
      LIMIT 80`,
    [keyword, like, like, like, like],
  );
  return rows;
}

export async function listServiceJobs({ status = 'open', limit = 200 } = {}) {
  ensureItServiceDB();
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const where = status === 'closed'
    ? "WHERE it.Status = '1'"
    : status === 'all'
      ? ''
      : "WHERE it.Status = '0'";
  const [rows] = await itServiceDB.query(
    `SELECT it.ID, it.Type, it.Details, it.ServiceProvider, it.ServiceApplicant,
            DATE_FORMAT(it.datetimeJob, '%d/%m/%Y %H:%i') AS datetimeJob,
            it.acknowledge, it.Overwork, it.Status, it.dateS, it.DateE,
            it.Causejob, it.DetailsJob, it.Dataack, it.coadjutor1, it.coadjutor2,
            it.overworkDetails,
            CONCAT(a.emp_profix, a.emp_name, ' ', a.emp_lastname) AS fullServiceApplicant,
            CONCAT(p.emp_profix, p.emp_name, ' ', p.emp_lastname, ' : ', IFNULL(NULLIF(p.emp_nickname, ''), '-')) AS fullServiceProvider
       FROM it_service it
       LEFT JOIN dbps2.psweb2_employee a ON a.emp_code = it.ServiceApplicant
       LEFT JOIN dbps2.psweb2_employee p ON p.emp_code = it.ServiceProvider
       ${where}
      ORDER BY it.ID ${status === 'closed' ? 'DESC' : 'ASC'}
      LIMIT ?`,
    [max],
  );
  return rows.map(mapJob);
}

export async function getServiceJob(id) {
  ensureItServiceDB();
  const [rows] = await itServiceDB.query(
    `SELECT it.*,
            DATE_FORMAT(it.datetimeJob, '%d/%m/%Y %H:%i') AS datetimeJob,
            CONCAT(a.emp_profix, a.emp_name, ' ', a.emp_lastname) AS fullServiceApplicant,
            CONCAT(p.emp_profix, p.emp_name, ' ', p.emp_lastname, ' : ', IFNULL(NULLIF(p.emp_nickname, ''), '-')) AS fullServiceProvider
       FROM it_service it
       LEFT JOIN dbps2.psweb2_employee a ON a.emp_code = it.ServiceApplicant
       LEFT JOIN dbps2.psweb2_employee p ON p.emp_code = it.ServiceProvider
      WHERE it.ID = ?
      LIMIT 1`,
    [id],
  );
  return mapJob(rows[0]);
}

export async function getNextServiceJobId() {
  ensureItServiceDB();
  const [rows] = await itServiceDB.query('SELECT IFNULL(MAX(ID), 0) + 1 AS next_id FROM it_service');
  return Number(rows[0]?.next_id || 1);
}

export async function createServiceJob({ type, details, applicant, provider }) {
  ensureItServiceDB();
  const cleanDetails = String(details || '').trim().replace(/[\r\n]+/g, ' ');
  const [result] = await itServiceDB.query(
    `INSERT INTO it_service
       (Type, Details, ServiceApplicant, ServiceProvider, Status, Acknowledge, Causejob, DetailsJob, Overwork, DateS)
     VALUES
       (?, ?, ?, ?, 0, 0, '-', '-', 0, NOW())`,
    [type, cleanDetails, applicant, provider],
  );
  return getServiceJob(result.insertId);
}

export async function acknowledgeServiceJob(id, { dataAck = '', coadjutor1 = '', coadjutor2 = '' } = {}) {
  ensureItServiceDB();
  await itServiceDB.query(
    `UPDATE it_service
        SET acknowledge = 1,
            datetimeJob = NOW(),
            Dataack = ?,
            coadjutor1 = ?,
            coadjutor2 = ?
      WHERE ID = ?`,
    [dataAck, coadjutor1 || null, coadjutor2 || null, id],
  );
  return getServiceJob(id);
}

export async function resetServiceJobAcknowledge(id) {
  ensureItServiceDB();
  await itServiceDB.query(
    "UPDATE it_service SET acknowledge = '0', datetimeJob = NULL WHERE ID = ?",
    [id],
  );
  return getServiceJob(id);
}

export async function toggleServiceJobOverwork(id, { overworkDetails = '' } = {}) {
  ensureItServiceDB();
  await itServiceDB.query(
    `UPDATE it_service
        SET Overwork = CASE WHEN Overwork = '1' THEN '0' ELSE '1' END,
            overworkDetails = CASE WHEN Overwork = '1' THEN overworkDetails ELSE ? END
      WHERE ID = ?`,
    [overworkDetails, id],
  );
  return getServiceJob(id);
}

export async function closeServiceJob(id, { causeJob, detailsJob }) {
  ensureItServiceDB();
  await itServiceDB.query(
    `UPDATE it_service
        SET Status = '1',
            DateE = NOW(),
            Causejob = ?,
            DetailsJob = ?
      WHERE ID = ?`,
    [causeJob, detailsJob, id],
  );
  return getServiceJob(id);
}

export async function reopenServiceJob(id) {
  ensureItServiceDB();
  await itServiceDB.query(
    "UPDATE it_service SET Status = '0', DateE = NULL WHERE ID = ?",
    [id],
  );
  return getServiceJob(id);
}

export async function deleteServiceJob(id) {
  ensureItServiceDB();
  await itServiceDB.query('DELETE FROM it_service WHERE ID = ?', [id]);
}

export async function serviceJobReport({
  startDate,
  endDate,
  startTime,
  endTime,
  type,
  provider,
  limit = 500,
} = {}) {
  ensureItServiceDB();
  const where = ["it.Status = '1'"];
  const args = [];
  const hasDateRange = Boolean(startDate && endDate);
  const normalizedStartTime = normalizeTime(startTime);
  const normalizedEndTime = normalizeTime(endTime);
  const hasTimeRange = Boolean(normalizedStartTime && normalizedEndTime);

  if (hasDateRange && hasTimeRange) {
    if (normalizedEndTime < normalizedStartTime) {
      where.push("DATE(it.datetimeJob) BETWEEN ? AND ? AND (TIME(it.datetimeJob) >= ? OR TIME(it.datetimeJob) < ?)");
      args.push(startDate, endDate, normalizedStartTime, normalizedEndTime);
    } else {
      where.push("it.datetimeJob BETWEEN CONCAT(?, ' ', ?) AND CONCAT(?, ' ', ?)");
      args.push(startDate, normalizedStartTime, endDate, normalizedEndTime);
    }
  } else if (hasDateRange) {
    where.push('DATE(it.datetimeJob) BETWEEN ? AND ?');
    args.push(startDate, endDate);
  } else if (hasTimeRange) {
    if (normalizedEndTime < normalizedStartTime) {
      where.push('(TIME(it.datetimeJob) >= ? OR TIME(it.datetimeJob) < ?)');
      args.push(normalizedStartTime, normalizedEndTime);
    } else {
      where.push('TIME(it.datetimeJob) BETWEEN ? AND ?');
      args.push(normalizedStartTime, normalizedEndTime);
    }
  }

  if (type) {
    where.push('it.Type = ?');
    args.push(type);
  }
  if (provider) {
    where.push('it.ServiceProvider = ?');
    args.push(provider);
  }
  args.push(Math.min(Math.max(Number(limit) || 500, 1), 1000));
  const [rows] = await itServiceDB.query(
    `SELECT it.ID, it.Type, it.Details, it.ServiceProvider, it.ServiceApplicant,
            DATE_FORMAT(it.datetimeJob, '%d/%m/%Y %H:%i') AS datetimeJob,
            it.acknowledge, it.Overwork, it.Status,
            DATE_FORMAT(it.DateS, '%d/%m/%Y %H:%i') AS dateS,
            DATE_FORMAT(it.DateE, '%d/%m/%Y %H:%i') AS dateE,
            it.Causejob, it.DetailsJob,
            CONCAT(empA.emp_profix, empA.emp_name, ' ', empA.emp_lastname) AS fullServiceApplicant,
            CONCAT(empP.emp_profix, empP.emp_name, ' ', empP.emp_lastname, ' : ', IFNULL(NULLIF(empP.emp_nickname, ''), '-')) AS fullServiceProvider
       FROM it_service it
       LEFT JOIN dbps2.psweb2_employee empA ON empA.emp_code = it.ServiceApplicant
       LEFT JOIN dbps2.psweb2_employee empP ON empP.emp_code = it.ServiceProvider
      WHERE ${where.join(' AND ')}
      ORDER BY it.ID DESC
      LIMIT ?`,
    args,
  );
  return rows.map((row) => ({
    id: Number(row.ID),
    type: row.Type,
    details: row.Details,
    service_provider: row.ServiceProvider,
    service_applicant: row.ServiceApplicant,
    provider_name: row.fullServiceProvider,
    applicant_name: row.fullServiceApplicant,
    datetime_job: row.datetimeJob,
    date_start: row.dateS,
    date_end: row.dateE,
    cause_job: row.Causejob || '',
    details_job: row.DetailsJob || '',
    status: Number(row.Status || 0),
    overwork: Number(row.Overwork || 0),
  }));
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return '';
  const hours = Math.min(Math.max(Number(match[1]), 0), 23);
  const minutes = Math.min(Math.max(Number(match[2]), 0), 59);
  const seconds = Math.min(Math.max(Number(match[3] || 0), 0), 59);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
