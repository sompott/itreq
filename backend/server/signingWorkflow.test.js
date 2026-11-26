import test from 'node:test';
import assert from 'node:assert/strict';
import { canSignStep } from './signingWorkflow.js';

const steps = [
  { step_no: 1, sign_stage: 'approval', status: 'pending', approver_emp_id: 'manager' },
  { step_no: 2, sign_stage: 'completion', status: 'pending', approver_emp_id: 'it' },
  { step_no: 3, sign_stage: 'acceptance', status: 'pending', approver_emp_id: 'it' },
  { step_no: 4, sign_stage: 'acceptance', status: 'pending', approver_emp_id: 'it' },
];

test('each slot waits for its configured signing stage', () => {
  for (const [index, status] of [[0, 'pending'], [1, 'completed'], [2, 'approved']]) {
    const step = steps[index];
    assert.equal(canSignStep({ step, steps, requestStatus: status, empId: step.approver_emp_id }), true);
    for (const otherStatus of ['draft', 'pending', 'approved', 'in_progress', 'completed', 'closed', 'cancelled', 'rejected'].filter((s) => s !== status)) {
      assert.equal(canSignStep({ step, steps, requestStatus: otherStatus, empId: step.approver_emp_id }), false);
    }
  }
});

test('signing order is enforced within a stage, independent of other stages', () => {
  assert.equal(canSignStep({ step: steps[3], steps, requestStatus: 'approved', empId: 'it' }), false);
  const completedPrevious = steps.map((step) => step.step_no === 3 ? { ...step, status: 'approved' } : step);
  assert.equal(canSignStep({ step: steps[3], steps: completedPrevious, requestStatus: 'approved', empId: 'it' }), true);
});

test('only the assigned employee or authorized IT staff can sign', () => {
  assert.equal(canSignStep({ step: steps[0], steps, requestStatus: 'pending', empId: 'other', isITStaff: true }), false);
  const groupStep = { step_no: 1, sign_stage: 'acceptance', signer_mode: 'it_staff', approver_emp_id: null, status: 'pending' };
  assert.equal(canSignStep({ step: groupStep, steps: [groupStep], requestStatus: 'approved', empId: 'other' }), false);
  assert.equal(canSignStep({ step: groupStep, steps: [groupStep], requestStatus: 'approved', empId: 'it', isITStaff: true }), true);
  assert.equal(canSignStep({ step: { ...groupStep, status: 'approved' }, steps: [groupStep], requestStatus: 'approved', empId: 'it', isITStaff: true }), false);
});

test('IT staff can sign an approval-stage slot configured as it_staff', () => {
  const itApproval = { step_no: 1, sign_stage: 'approval', signer_mode: 'it_staff', approver_emp_id: null, status: 'pending' };
  assert.equal(canSignStep({ step: itApproval, steps: [itApproval], requestStatus: 'pending', empId: 'it', isITStaff: true }), true);
  assert.equal(canSignStep({ step: itApproval, steps: [itApproval], requestStatus: 'pending', empId: 'user', isITStaff: false }), false);
});
