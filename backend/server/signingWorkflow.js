export const SIGNING_STAGE_STATUS = { approval: 'pending', acceptance: 'approved', completion: 'completed' };

export function canSignStep({ step, steps, requestStatus, empId, isITStaff = false }) {
  const stage = step.sign_stage || 'approval';
  return step.status === 'pending'
    && SIGNING_STAGE_STATUS[stage] === requestStatus
    && (step.approver_emp_id === empId || (step.signer_mode === 'it_staff' && !step.approver_emp_id && isITStaff))
    && !steps.some((earlier) => (earlier.sign_stage || 'approval') === stage
      && earlier.step_no < step.step_no && earlier.status === 'pending');
}
