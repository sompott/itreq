import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, BriefcaseBusiness, Clock, FileText, Moon, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sun, Wrench } from 'lucide-react';
import { api } from './lib/api.js';
import { navigate, useHashRoute } from './lib/useHashRoute.js';
import NotificationBell from './components/NotificationBell.jsx';
import CreateRequestPage from './pages/CreateRequest.jsx';
import MyRequestsPage from './pages/MyRequests.jsx';
import ApprovalsPage from './pages/Approvals.jsx';
import ITQueuePage from './pages/ITQueue.jsx';
import AdminPage from './pages/Admin.jsx';
import ReportsPage from './pages/Reports.jsx';
import ITServicesPage from './pages/ITServices.jsx';
import ITServicesReportPage from './pages/ITServicesReport.jsx';
import MonitorPage from './pages/Monitor.jsx';
import './styles.css';

const INITIAL_THEME = localStorage.getItem('colorTheme')
  || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = INITIAL_THEME;

function Shell({ theme, onToggleTheme }) {
  const [user, setUser] = useState(null);
  const [loginUrl, setLoginUrl] = useState(null);
  const [booted, setBooted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  const path = useHashRoute();

  useEffect(() => {
    api('/auth/me')
      .then((d) => {
        if (d?._unauthorized) setLoginUrl(d.login_url || '#');
        else setUser(d.user);
      })
      .finally(() => setBooted(true));
  }, []);

  if (!booted) return <div className="boot">กำลังโหลด...</div>;

  const role = user?.role || 'requester';
  const canApprove = role === 'admin' || role === 'approver' || true;
  const canITStaff = role === 'admin' || role === 'it_staff';
  const isAdmin = role === 'admin';

  let page;
  if (path === '/' || path === '/create') page = <CreateRequestPage user={user} />;
  else if (path === '/my') page = <MyRequestsPage subPath="" user={user} />;
  else if (path.startsWith('/my/')) page = <MyRequestsPage subPath={path.slice(3)} user={user} />;
  else if (path === '/approve') page = <ApprovalsPage subPath="" user={user} />;
  else if (path.startsWith('/approve/')) page = <ApprovalsPage subPath={path.slice(8)} user={user} />;
  else if (path === '/staff') page = <ITQueuePage subPath="" user={user} />;
  else if (path.startsWith('/staff/')) page = <ITQueuePage subPath={path.slice(6)} user={user} />;
  else if (path === '/it-services') page = <ITServicesPage />;
  else if (path === '/it-services/report') page = <ITServicesReportPage />;
  else if (path === '/reports') page = <ReportsPage />;
  else if (path === '/admin') page = <AdminPage subPath="" />;
  else if (path.startsWith('/admin/')) page = <AdminPage subPath={path.slice(6)} />;
  else page = <CreateRequestPage user={user} />;

  const navItems = [
    { to: '/', icon: <Plus size={17} />, label: 'สร้างคำขอ' },
    { to: '/my', icon: <FileText size={17} />, label: 'คำขอของฉัน' },
    canApprove ? { to: '/approve', icon: <Clock size={17} />, label: 'งานเซ็นเอกสาร' } : null,
    canITStaff ? { to: '/staff', icon: <Wrench size={17} />, label: 'งาน IT' } : null,
    { to: '/it-services', icon: <BriefcaseBusiness size={17} />, label: 'IT Services' },
    isAdmin ? { to: '/reports', icon: <BarChart3 size={17} />, label: 'รายงาน' } : null,
    isAdmin ? { to: '/admin', icon: <Settings size={17} />, label: 'Admin' } : null,
  ].filter(Boolean);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  }

  return (
    <div className={`root-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <AppSidebar current={path} items={navItems} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <header className="topbar">
        <div className="brand-row">
          <button className="brand-tag" onClick={() => navigate('/')}>
            <span className="brand-mark">IT</span>
            <span>
              <strong>ระบบขอใช้งาน IT</strong>
              <small>แผนกเทคโนโลยีสารสนเทศ</small>
            </span>
          </button>
        </div>

        <div id="topbar-step-slot" className="topbar-step-slot" />

        <div className="top-right">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {user ? <NotificationBell /> : null}
          {user ? (
            <div className="user-chip" title={`${user.emp_id} - ${role}`}>
              <span className="avatar">{user.name?.slice(0, 2) || '?'}</span>
              <div className="user-meta">
                <b>{user.name}</b>
                <small>{user.department} - {role}</small>
              </div>
            </div>
          ) : null}
          {loginUrl ? (
            <a className="btn primary" href={loginUrl}>เข้าสู่ระบบ psweb2</a>
          ) : null}
        </div>
      </header>

      {loginUrl ? (
        <div className="login-banner">
          <b>ยังไม่ได้เข้าสู่ระบบ</b> - ระบบไม่พบ cookie ของ psweb2
          {' (Dev: เปิด DevTools -> Application -> Cookies -> เพิ่ม UserInfo เอง แล้ว refresh)'}
        </div>
      ) : null}

      <div className="content-area">{page}</div>
    </div>
  );
}

function AppSidebar({ current, items, collapsed, onToggle }) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-head">
        <button className="sidebar-brand" onClick={() => navigate('/')} title="IT Request">
          <span className="brand-mark">IT</span>
          <span className="sidebar-label">
            <strong>IT Request</strong>
            <small>Service workflow</small>
          </span>
        </button>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <nav className="side-nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} current={current} icon={item.icon}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function NavLink({ to, current, icon, children }) {
  const active = current === to || (to !== '/' && current.startsWith(to));
  return (
    <button className={`side-nav-link ${active ? 'active' : ''}`} onClick={() => navigate(to)}>
      {icon}<span>{children}</span>
    </button>
  );
}

function App() {
  const path = useHashRoute();
  const [theme, setTheme] = useState(INITIAL_THEME);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('colorTheme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');
  if (path === '/it-services/monitor') return <MonitorPage />;
  return <Shell theme={theme} onToggleTheme={toggleTheme} />;
}

createRoot(document.getElementById('root')).render(<App />);
