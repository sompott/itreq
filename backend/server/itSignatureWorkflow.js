export const IT_SIGNATURE_PHASES = {
  acceptance: { label: 'IT ลงนามรับงาน', statuses: ['approved'] },
  completion: { label: 'IT ลงนามยืนยันงานเสร็จ', statuses: ['completed'] },
};

export function validateITSignature({ phase, status, enabled = true, signatures = [], approvals = [] }) {
  const config = Object.hasOwn(IT_SIGNATURE_PHASES, phase) ? IT_SIGNATURE_PHASES[phase] : null;
  const fail = (message) => { throw Object.assign(new Error(message), { httpStatus: 409 }); };
  if (!config) fail('invalid_it_signature_phase');
  if (!enabled) fail('it_signature_phase_disabled');
  if (!config.statuses.includes(status)) fail('it_signature_wrong_status');
  if (approvals.some((step) => !['approved', 'skipped'].includes(step.status))) fail('approvals_not_complete');
  if (signatures.some((signature) => signature.phase === phase)) fail('it_signature_already_signed');
}
