export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/itrequest/api';
export const EMP_PICTURE_URL = import.meta.env.VITE_EMP_PICTURE_URL || 'http://www.pssugar.com/empPicture';
export const SIGN_IMAGE_URL = import.meta.env.VITE_SIGN_IMAGE_URL || 'https://www.pssugar.com/signImage';

export const empPicture = (empCode) => `${EMP_PICTURE_URL}/${empCode}.jpg`;
export const empSignature = (empCode) => `${SIGN_IMAGE_URL}/${empCode}.PNG`;

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    return { _unauthorized: true, ...body };
  }
  if (response.status === 403) {
    throw Object.assign(new Error('forbidden'), { status: 403 });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `API ${path} failed (${response.status})`), {
      status: response.status,
    });
  }
  return response.json();
}
