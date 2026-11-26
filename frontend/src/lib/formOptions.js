export const OTHER_OPTION = '__itreq_other__';
export const OTHER_LABEL = 'อื่น ๆ';
const OTHER_PREFIX = `${OTHER_LABEL}:`;

export function isOtherValue(value) {
  return String(value || '').trimStart().startsWith(OTHER_PREFIX);
}

export function makeOtherValue(detail = '') {
  return `${OTHER_PREFIX} ${String(detail || '').trimStart()}`;
}

export function otherDetail(value) {
  if (!isOtherValue(value)) return '';
  return String(value).slice(String(value).indexOf(':') + 1).trimStart();
}

export function parseMultiValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

export function serializeMultiValue(values) {
  return JSON.stringify(values.filter(Boolean));
}

export function hasIncompleteOther(value, multiple = false) {
  const values = multiple ? parseMultiValue(value) : [value];
  const other = values.find(isOtherValue);
  return Boolean(other && !otherDetail(other).trim());
}
