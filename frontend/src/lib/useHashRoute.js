import { useEffect, useState } from 'react';

/** คืน path ปัจจุบันจาก hash เช่น "/admin/2" จาก #/admin/2 */
export function useHashRoute() {
  const [hash, setHash] = useState(() => normalize(window.location.hash));
  useEffect(() => {
    const onChange = () => setHash(normalize(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

function normalize(h) {
  if (!h || h === '#') return '/';
  return h.replace(/^#/, '');
}
