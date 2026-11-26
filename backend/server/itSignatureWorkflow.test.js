import test from 'node:test';
import assert from 'node:assert/strict';
import { validateITSignature } from './itSignatureWorkflow.js';

test('IT accepts only after approvals finish and before work starts', () => {
  assert.doesNotThrow(() => validateITSignature({ phase: 'acceptance', status: 'approved', approvals: [{ status: 'approved' }, { status: 'skipped' }] }));
  for (const status of ['draft', 'pending', 'in_progress', 'completed', 'closed', 'rejected', 'cancelled']) {
    assert.throws(() => validateITSignature({ phase: 'acceptance', status }), /it_signature_wrong_status/);
  }
  assert.throws(() => validateITSignature({ phase: 'acceptance', status: 'approved', approvals: [{ status: 'pending' }] }), /approvals_not_complete/);
});

test('IT confirms completion only after work completes and before closing', () => {
  assert.doesNotThrow(() => validateITSignature({ phase: 'completion', status: 'completed', signatures: [{ phase: 'acceptance' }] }));
  for (const status of ['draft', 'pending', 'approved', 'in_progress', 'closed', 'rejected', 'cancelled']) {
    assert.throws(() => validateITSignature({ phase: 'completion', status }), /it_signature_wrong_status/);
  }
});

test('each phase is signed once, and invalid phases are rejected', () => {
  for (const [phase, status] of [['acceptance', 'approved'], ['completion', 'completed']]) {
    assert.throws(() => validateITSignature({ phase, status, signatures: [{ phase }] }), /it_signature_already_signed/);
  }
  assert.throws(() => validateITSignature({ phase: 'other', status: 'approved' }), /invalid_it_signature_phase/);
  assert.throws(() => validateITSignature({ phase: '__proto__', status: 'approved' }), /invalid_it_signature_phase/);
});

test('disabled signing phase cannot be used for another request type', () => {
  assert.throws(() => validateITSignature({ phase: 'acceptance', status: 'approved', enabled: false }), /it_signature_phase_disabled/);
  assert.doesNotThrow(() => validateITSignature({ phase: 'acceptance', status: 'approved', enabled: true }));
});
