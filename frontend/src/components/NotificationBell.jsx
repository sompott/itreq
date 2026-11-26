import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../lib/api.js';
import { navigate } from '../lib/useHashRoute.js';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    function onDoc(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function load() {
    try {
      const d = await api('/notifications');
      if (d?._unauthorized) return;
      setItems(d.items || []);
      setUnread(d.unread || 0);
    } catch {}
  }

  async function readOne(n) {
    await api(`/notifications/${n.id}/read`, { method: 'POST' });
    if (n.link_url) navigate(n.link_url.replace(/^.*#/, ''));
    setOpen(false);
    load();
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-btn" onClick={() => setOpen((v) => !v)} title="แจ้งเตือน">
        <Bell size={20} />
        {unread ? <span className="notif-count">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="notif-pop">
          <div className="notif-head">
            <b>แจ้งเตือน</b>
            {unread ? <button className="link" onClick={readAll}>อ่านทั้งหมด</button> : null}
          </div>
          <ul>
            {items.length === 0 ? <li className="empty">ไม่มีแจ้งเตือน</li> : null}
            {items.map((n) => (
              <li key={n.id} className={n.is_read ? '' : 'unread'} onClick={() => readOne(n)}>
                <b>{n.title}</b>
                <span>{n.message}</span>
                <time>{new Date(n.created_at).toLocaleString('th-TH')}</time>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
