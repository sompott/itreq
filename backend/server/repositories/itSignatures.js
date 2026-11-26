import { appDB } from '../db.js';
import { getEmployeeById } from './employees.js';
import { hasVisibleInkDataUrl, saveSignatureDataUrl, deleteSignatureFile } from './signatures.js';
import { validateITSignature } from '../itSignatureWorkflow.js';

export async function listITSignatures(requestId) {
  let rows;
  try {
    [rows] = await appDB.query('SELECT * FROM itreq_request_it_signatures WHERE request_id = ? ORDER BY id', [requestId]);
  } catch (err) {
    // Existing installations can still read requests before the migration runs.
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
  return Promise.all(rows.map(async (row) => ({
    ...row,
    status: 'approved',
    approver_emp_id: row.signer_emp_id,
    approver: await getEmployeeById(row.signer_emp_id),
    signature_url: row.signature_file
      ? `/itrequest/api/signatures/${encodeURIComponent(row.signature_file)}`
      : row.signature_data,
  })));
}

export async function signITRequest({ requestId, phase, signerEmpId, signatureType, signatureData, comment }) {
  const signer = await getEmployeeById(signerEmpId);
  if (signatureType === 'fetch') {
    if (!signer?.has_signature || !signer.signature_url) {
      throw Object.assign(new Error('approver_signature_not_registered'), { httpStatus: 400 });
    }
    signatureData = signer.signature_url;
  } else {
    signatureType = 'draw';
    if (!hasVisibleInkDataUrl(signatureData)) {
      throw Object.assign(new Error('signature_blank'), { httpStatus: 400 });
    }
  }
  const conn = await appDB.getConnection();
  let signatureFile = null;
  try {
    await conn.beginTransaction();
    const [[request]] = await conn.query(
      `SELECT r.status, t.it_acceptance_required, t.it_completion_required
         FROM itreq_requests r JOIN itreq_request_types t ON t.id = r.request_type_id
        WHERE r.id = ? FOR UPDATE`, [requestId]);
    if (!request) throw Object.assign(new Error('request_not_found'), { httpStatus: 404 });
    const [signatures] = await conn.query('SELECT phase FROM itreq_request_it_signatures WHERE request_id = ?', [requestId]);
    const [approvals] = await conn.query('SELECT status FROM itreq_request_approval_steps WHERE request_id = ?', [requestId]);
    validateITSignature({ phase, status: request.status, enabled: !!request[`it_${phase}_required`], signatures, approvals });
    if (signatureType === 'draw') {
      signatureFile = await saveSignatureDataUrl(signatureData, `req${requestId}_it_${phase}`);
      if (!signatureFile) throw Object.assign(new Error('signature_invalid'), { httpStatus: 400 });
      signatureData = null;
    }
    await conn.query(
      `INSERT INTO itreq_request_it_signatures
        (request_id, phase, signer_emp_id, signature_type, signature_data, signature_file, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [requestId, phase, signerEmpId, signatureType, signatureData, signatureFile, comment || null],
    );
    await conn.query(
      `INSERT INTO itreq_request_logs (request_id, action, actor_emp_id, note)
       VALUES (?, 'it_sign', ?, ?)`,
      [requestId, signerEmpId, `${phase}${comment ? `: ${comment}` : ''}`],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (signatureFile) await deleteSignatureFile(signatureFile);
    throw err;
  } finally {
    conn.release();
  }
}
