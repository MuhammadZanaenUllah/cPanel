import { useState, useEffect, useCallback, useRef } from 'react';

const API = '';
const TOKEN_KEY = 'whm_jwt';

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'accounts' | 'account_detail' | 'plans' | 'dns' | 'server' | 'resellers' | 'activity';

interface Account {
  id: string;
  username: string;
  primary_domain: string;
  email: string;
  status: 'active' | 'suspended' | 'terminated' | 'provisioning';
  role: string;
  plan_id?: string;
  plan_name?: string;
  created_at: string;
  last_login_ip?: string;
  home_dir?: string;
}

interface AccountDetail extends Account {
  plan?: Plan;
  usage?: {
    email_accounts: number;
    databases: number;
    ftp_accounts: number;
    addon_domains: number;
  };
}

interface Plan {
  id: string;
  name: string;
  disk_mb: number;
  bandwidth_mb: number;
  max_email_accounts: number;
  max_databases: number;
  max_ftp_accounts: number;
  max_addon_domains: number;
  price_monthly?: number;
  is_active: boolean;
  account_count?: number;
}

interface Stats {
  accounts: number;
  domains: number;
  emails: number;
  plans: number;
  suspended: number;
  provisioning: number;
  ftp_accounts: number;
  databases: number;
}

interface ServiceStatus {
  mysql: { online: boolean; latency?: number };
  redis: { online: boolean; latency?: number };
  api: { online: boolean };
}

interface ActivityEntry {
  id: string;
  username: string;
  domain: string;
  status: string;
  created_at: string;
  event?: string;
}

interface Toast {
  msg: string;
  ok: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, unit: string) => {
  if (n >= 1024) return `${(n / 1024).toFixed(1)} G${unit}`;
  return `${n} M${unit}`;
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IcoDashboard = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const IcoUsers = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;
const IcoBox = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L11 21.73a2 2 0 0 0 2 0L20 17.73A2 2 0 0 0 21 16z" />;
const IcoGlobe = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />;
const IcoServer = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01" />;
const IcoUserCheck = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 11l2 2 4-4" />;
const IcoClock = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" />;
const IcoEye = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />;
const IcoEdit = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />;
const IcoTrash = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />;
const IcoPlus = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M12 5v14M5 12h14" />;
const IcoArrowLeft = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M19 12H5M12 5l-7 7 7 7" />;
const IcoRefresh = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />;
const IcoShield = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const IcoKey = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />;

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    suspended: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    terminated: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    provisioning: { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    online: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    offline: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  };
  const c = colors[status] || { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status}
    </span>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #334155' }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

// ─── Form Field ───────────────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
  color: '#f1f5f9', padding: '8px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box'
};

// ─── Btn ──────────────────────────────────────────────────────────────────────

const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, style: extraStyle }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'ghost' | 'warning' | 'success';
  size?: 'sm' | 'md'; disabled?: boolean; style?: React.CSSProperties;
}) => {
  const [hover, setHover] = useState(false);
  const colors = {
    primary: { bg: '#6366f1', hbg: '#4f46e5', color: '#fff' },
    danger: { bg: '#ef4444', hbg: '#dc2626', color: '#fff' },
    ghost: { bg: 'transparent', hbg: 'rgba(99,102,241,0.1)', color: '#94a3b8' },
    warning: { bg: '#f59e0b', hbg: '#d97706', color: '#fff' },
    success: { bg: '#22c55e', hbg: '#16a34a', color: '#fff' },
  }[variant];
  const pad = size === 'sm' ? '5px 10px' : '8px 16px';
  const fsize = size === 'sm' ? 12 : 14;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? colors.hbg : colors.bg,
        color: colors.color,
        border: variant === 'ghost' ? '1px solid #334155' : 'none',
        borderRadius: 6, padding: pad, fontSize: fsize, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 0.15s',
        ...extraStyle
      }}>
      {children}
    </button>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

const Card = ({ children, style: extraStyle }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, ...extraStyle }}>
    {children}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon, color = '#6366f1' }: { label: string; value: number | string; icon: React.ReactNode; color?: string }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ color, opacity: 0.8 }}>{icon}</span>
    </div>
    <div style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700 }}>{value}</div>
  </Card>
);

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loggedInAs, setLoggedInAs] = useState('');
  const [view, setView] = useState<View>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState<Plan | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState<Account | null>(null);

  // Filters
  const [accountFilter, setAccountFilter] = useState<'all' | 'active' | 'suspended' | 'provisioning'>('all');
  const [accountSearch, setAccountSearch] = useState('');

  const showToast = (msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setLoggedInAs('');
  }, []);

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const res = await fetch(API + url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) }
    });
    if (res.status === 401) { handleLogout(); throw new Error('Unauthorized'); }
    return res;
  }, [token, handleLogout]);

  const loadAccounts = useCallback(async () => {
    try {
      const r = await authFetch('/whm/accounts');
      if (r.ok) setAccounts(await r.json());
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadPlans = useCallback(async () => {
    try {
      const r = await authFetch('/whm/plans/all');
      if (r.ok) setPlans(await r.json());
      else {
        const r2 = await authFetch('/whm/plans');
        if (r2.ok) setPlans(await r2.json());
      }
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadStats = useCallback(async () => {
    try {
      const r = await authFetch('/whm/stats');
      if (r.ok) setStats(await r.json());
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadServiceStatus = useCallback(async () => {
    try {
      const r = await authFetch('/whm/service-status');
      if (r.ok) setServiceStatus(await r.json());
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadActivity = useCallback(async () => {
    try {
      const r = await authFetch('/whm/activity');
      if (r.ok) setActivity(await r.json());
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadAccountDetail = useCallback(async (id: string) => {
    try {
      const r = await authFetch(`/whm/accounts/${id}`);
      if (r.ok) setAccountDetail(await r.json());
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    if (!token) return;
    Promise.all([loadAccounts(), loadPlans(), loadStats(), loadServiceStatus(), loadActivity()])
      .finally(() => setLoading(false));
  }, [token, loadAccounts, loadPlans, loadStats, loadServiceStatus, loadActivity]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadServiceStatus, 30000);
    return () => clearInterval(interval);
  }, [token, loadServiceStatus]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadActivity, 60000);
    return () => clearInterval(interval);
  }, [token, loadActivity]);

  useEffect(() => {
    if (view === 'account_detail' && selectedAccountId) {
      loadAccountDetail(selectedAccountId);
    }
  }, [view, selectedAccountId, loadAccountDetail]);

  // ─── Login Screen ─────────────────────────────────────────────────────────

  if (!token) return <LoginScreen onLogin={(t, u) => { setToken(t); setLoggedInAs(u); localStorage.setItem(TOKEN_KEY, t); }} />;

  if (loading) return (
    <div style={{ background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: 16 }}>Loading WHM...</div>
    </div>
  );

  // ─── Derived data ──────────────────────────────────────────────────────────

  const filteredAccounts = accounts.filter(a => {
    if (accountFilter !== 'all' && a.status !== accountFilter) return false;
    if (accountSearch) {
      const q = accountSearch.toLowerCase();
      return a.username.toLowerCase().includes(q) || a.primary_domain.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    }
    return true;
  });

  const resellers = accounts.filter(a => a.role === 'reseller');

  const countByStatus = (s: string) => accounts.filter(a => a.status === s).length;

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleSuspend = async (a: Account) => {
    const action = a.status === 'suspended' ? 'unsuspend' : 'suspend';
    const r = await authFetch(`/whm/accounts/${a.id}/${action}`, { method: 'POST' });
    if (r.ok) { showToast(`Account ${action}ed`, true); loadAccounts(); loadStats(); }
    else showToast(`Failed to ${action}`, false);
  };

  const handleTerminate = async (a: Account) => {
    const r = await authFetch(`/whm/accounts/${a.id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Account terminated', true); setShowTerminateConfirm(null); loadAccounts(); loadStats(); }
    else showToast('Failed to terminate', false);
  };

  const handleTogglePlan = async (p: Plan) => {
    const r = await authFetch(`/whm/plans/${p.id}/toggle`, { method: 'PATCH' });
    if (r.ok) { showToast(`Plan ${p.is_active ? 'deactivated' : 'activated'}`, true); loadPlans(); }
    else showToast('Failed to toggle plan', false);
  };

  const handleDeletePlan = async (p: Plan) => {
    if ((p.account_count || 0) > 0) { showToast('Cannot delete: plan has accounts', false); return; }
    const r = await authFetch(`/whm/plans/${p.id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Plan deleted', true); loadPlans(); }
    else showToast('Failed to delete plan', false);
  };

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <IcoDashboard /> },
    { id: 'accounts', label: 'Hosting Accounts', icon: <IcoUsers /> },
    { id: 'plans', label: 'Plans & Packages', icon: <IcoBox /> },
    { id: 'dns', label: 'DNS Management', icon: <IcoGlobe /> },
    { id: 'server', label: 'Server Status', icon: <IcoServer /> },
    { id: 'resellers', label: 'Resellers', icon: <IcoUserCheck /> },
    { id: 'activity', label: 'Activity Log', icon: <IcoClock /> },
  ];

  const viewTitles: Record<View, string> = {
    dashboard: 'Dashboard', accounts: 'Hosting Accounts', account_detail: 'Account Detail',
    plans: 'Plans & Packages', dns: 'DNS Management', server: 'Server Status',
    resellers: 'Resellers', activity: 'Activity Log',
  };

  const goToDetail = (id: string) => { setSelectedAccountId(id); setView('account_detail'); };

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <nav style={{ width: 220, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoServer size={16} />
            </div>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>WHM</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Web Host Manager</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = view === item.id || (item.id === 'accounts' && view === 'account_detail');
            return (
              <NavItem key={item.id} active={active} onClick={() => setView(item.id)}>
                {item.icon}{item.label}
              </NavItem>
            );
          })}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>Logged in as</div>
          <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{loggedInAs || 'admin'}</div>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h1 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>{viewTitles[view]}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Btn variant="ghost" size="sm" onClick={() => { loadAccounts(); loadPlans(); loadStats(); loadServiceStatus(); loadActivity(); showToast('Refreshed', true); }}>
              <IcoRefresh size={14} /> Refresh
            </Btn>
            <Btn variant="danger" size="sm" onClick={handleLogout}>Logout</Btn>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {view === 'dashboard' && <DashboardView stats={stats} serviceStatus={serviceStatus} activity={activity} accounts={accounts} onCreateAccount={() => setShowCreateAccount(true)} onCreatePlan={() => setShowCreatePlan(true)} onViewAccount={goToDetail} />}
          {view === 'accounts' && (
            <AccountsView accounts={filteredAccounts} allAccounts={accounts} filter={accountFilter} search={accountSearch} onFilterChange={setAccountFilter} onSearchChange={setAccountSearch} onView={goToDetail} onSuspend={handleSuspend} onTerminate={a => setShowTerminateConfirm(a)} onCreateAccount={() => setShowCreateAccount(true)} countByStatus={countByStatus} />
          )}
          {view === 'account_detail' && accountDetail && (
            <AccountDetailView detail={accountDetail} plans={plans} onBack={() => setView('accounts')} onSuspend={handleSuspend} onTerminate={a => setShowTerminateConfirm(a)} onChangePlan={() => setShowChangePlan(true)} onChangePassword={() => setShowChangePassword(true)} />
          )}
          {view === 'plans' && (
            <PlansView plans={plans} onEdit={p => setShowEditPlan(p)} onToggle={handleTogglePlan} onDelete={handleDeletePlan} onCreatePlan={() => setShowCreatePlan(true)} />
          )}
          {view === 'dns' && <DnsView accounts={accounts} authFetch={authFetch} showToast={showToast} />}
          {view === 'server' && <ServerStatusView serviceStatus={serviceStatus} stats={stats} onRefresh={() => { loadServiceStatus(); loadStats(); }} />}
          {view === 'resellers' && <ResellersView resellers={resellers} onView={goToDetail} onSuspend={handleSuspend} onTerminate={a => setShowTerminateConfirm(a)} />}
          {view === 'activity' && <ActivityView activity={activity} onRefresh={loadActivity} />}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.ok ? '#22c55e' : '#ef4444', color: '#fff', padding: '12px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {showCreateAccount && (
        <CreateAccountModal plans={plans} onClose={() => setShowCreateAccount(false)} onSuccess={() => { setShowCreateAccount(false); loadAccounts(); loadStats(); showToast('Account created', true); }} authFetch={authFetch} showToast={showToast} />
      )}
      {showCreatePlan && (
        <CreatePlanModal onClose={() => setShowCreatePlan(false)} onSuccess={() => { setShowCreatePlan(false); loadPlans(); showToast('Plan created', true); }} authFetch={authFetch} showToast={showToast} />
      )}
      {showEditPlan && (
        <EditPlanModal plan={showEditPlan} onClose={() => setShowEditPlan(null)} onSuccess={() => { setShowEditPlan(null); loadPlans(); showToast('Plan updated', true); }} authFetch={authFetch} showToast={showToast} />
      )}
      {showChangePlan && accountDetail && (
        <ChangePlanModal account={accountDetail} plans={plans} onClose={() => setShowChangePlan(false)} onSuccess={() => { setShowChangePlan(false); loadAccountDetail(accountDetail.id); loadAccounts(); showToast('Plan changed', true); }} authFetch={authFetch} showToast={showToast} />
      )}
      {showChangePassword && accountDetail && (
        <ChangePasswordModal account={accountDetail} onClose={() => setShowChangePassword(false)} onSuccess={() => { setShowChangePassword(false); showToast('Password changed', true); }} authFetch={authFetch} showToast={showToast} />
      )}
      {showTerminateConfirm && (
        <Modal title="Confirm Termination" onClose={() => setShowTerminateConfirm(null)} width={420}>
          <p style={{ color: '#f1f5f9', marginTop: 0 }}>
            Are you sure you want to terminate <strong>{showTerminateConfirm.username}</strong>? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowTerminateConfirm(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => handleTerminate(showTerminateConfirm)}>Terminate Account</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Nav Item ──────────────────────────────────────────────────────────────────

const NavItem = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', background: active ? 'rgba(99,102,241,0.15)' : hover ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none', borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
        color: active ? '#6366f1' : hover ? '#f1f5f9' : '#94a3b8',
        padding: '9px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 10, fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left', marginBottom: 2, transition: 'all 0.15s'
      }}>
      {children}
    </button>
  );
};

// ─── Login Screen ──────────────────────────────────────────────────────────────

const LoginScreen = ({ onLogin }: { onLogin: (token: string, username: string) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const r = await fetch(API + '/whm/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Login failed'); return; }
      onLogin(data.token, data.username);
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <IcoShield size={26} />
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>WHM Login</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Web Host Manager — Admins only</p>
        </div>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 28 }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{error}</div>}
          <form onSubmit={submit}>
            <Field label="Username">
              <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoFocus />
            </Field>
            <Field label="Password">
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <button type="submit" disabled={loading} style={{ width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              {loading ? 'Signing in...' : 'Sign In to WHM'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard View ────────────────────────────────────────────────────────────

const DashboardView = ({ stats, serviceStatus, activity, accounts, onCreateAccount, onCreatePlan, onViewAccount }: {
  stats: Stats | null; serviceStatus: ServiceStatus | null; activity: ActivityEntry[];
  accounts: Account[]; onCreateAccount: () => void; onCreatePlan: () => void; onViewAccount: (id: string) => void;
}) => {
  const recentAccounts = [...accounts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

  return (
    <div>
      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <Btn onClick={onCreateAccount}><IcoPlus size={14} /> Create Account</Btn>
        <Btn variant="ghost" onClick={onCreatePlan}><IcoPlus size={14} /> Create Plan</Btn>
      </div>

      {/* Stats Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Total Accounts" value={stats?.accounts ?? '—'} icon={<IcoUsers size={20} />} color="#6366f1" />
        <StatCard label="Total Domains" value={stats?.domains ?? '—'} icon={<IcoGlobe size={20} />} color="#22c55e" />
        <StatCard label="Email Accounts" value={stats?.emails ?? '—'} icon={<IcoBox size={20} />} color="#f59e0b" />
        <StatCard label="Active Plans" value={stats?.plans ?? '—'} icon={<IcoServer size={20} />} color="#8b5cf6" />
      </div>

      {/* Stats Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Suspended" value={stats?.suspended ?? '—'} icon={<IcoShield size={20} />} color="#ef4444" />
        <StatCard label="Provisioning" value={stats?.provisioning ?? '—'} icon={<IcoClock size={20} />} color="#f97316" />
        <StatCard label="Databases" value={stats?.databases ?? '—'} icon={<IcoBox size={20} />} color="#06b6d4" />
        <StatCard label="FTP Accounts" value={stats?.ftp_accounts ?? '—'} icon={<IcoKey size={20} />} color="#84cc16" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Service Status */}
        <Card>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Service Health</div>
          {serviceStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'MySQL Database', key: 'mysql', icon: <IcoServer size={16} /> },
                { name: 'Redis Cache', key: 'redis', icon: <IcoServer size={16} /> },
                { name: 'API Server', key: 'api', icon: <IcoServer size={16} /> },
              ].map(s => {
                const svc = serviceStatus[s.key as keyof ServiceStatus] as { online: boolean; latency?: number };
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f1f5f9' }}>
                      <span style={{ color: '#94a3b8' }}>{s.icon}</span>
                      <span style={{ fontSize: 14 }}>{s.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {svc.latency !== undefined && <span style={{ color: '#94a3b8', fontSize: 12 }}>{svc.latency}ms</span>}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: svc.online ? '#22c55e' : '#ef4444', boxShadow: svc.online ? '0 0 6px #22c55e' : '0 0 6px #ef4444' }} />
                      <span style={{ color: svc.online ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: 600 }}>{svc.online ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading service status...</div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Recent Activity</div>
          {activity.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 14 }}>No recent activity</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.slice(0, 6).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #334155' }}>
                  <div>
                    <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>{a.username}</span>
                    <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>{a.domain}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={a.status} />
                    <span style={{ color: '#64748b', fontSize: 11 }}>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Accounts Table */}
      <Card style={{ marginTop: 24 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Recent Accounts</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              {['Username', 'Domain', 'Status', 'Created'].map(h => (
                <th key={h} style={{ color: '#94a3b8', fontWeight: 600, padding: '8px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentAccounts.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => onViewAccount(a.id)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>{a.username}</button>
                </td>
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{a.primary_domain}</td>
                <td style={{ padding: '10px 12px' }}><StatusBadge status={a.status} /></td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{timeAgo(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ─── Accounts View ─────────────────────────────────────────────────────────────

const AccountsView = ({ accounts, allAccounts, filter, search, onFilterChange, onSearchChange, onView, onSuspend, onTerminate, onCreateAccount, countByStatus }: {
  accounts: Account[]; allAccounts: Account[]; filter: string; search: string;
  onFilterChange: (f: any) => void; onSearchChange: (s: string) => void;
  onView: (id: string) => void; onSuspend: (a: Account) => void; onTerminate: (a: Account) => void;
  onCreateAccount: () => void; countByStatus: (s: string) => number;
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['all', 'active', 'suspended', 'provisioning'] as const).map(f => (
          <FilterTab key={f} active={filter === f} onClick={() => onFilterChange(f)} label={f} count={f === 'all' ? allAccounts.length : countByStatus(f)} />
        ))}
      </div>
      <Btn onClick={onCreateAccount}><IcoPlus size={14} /> Create Account</Btn>
    </div>
    <div style={{ marginBottom: 16 }}>
      <input
        style={{ ...inputStyle, maxWidth: 320 }}
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search username, domain, email..."
      />
    </div>
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #334155' }}>
            {['Username', 'Primary Domain', 'Email', 'Plan', 'Status', 'Created', 'Actions'].map(h => (
              <th key={h} style={{ color: '#94a3b8', fontWeight: 600, padding: '12px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No accounts found</td></tr>
          ) : accounts.map(a => (
            <AccountRow key={a.id} account={a} onView={onView} onSuspend={onSuspend} onTerminate={onTerminate} />
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const FilterTab = ({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: active ? '#6366f1' : hover ? 'rgba(99,102,241,0.1)' : 'transparent',
        border: '1px solid', borderColor: active ? '#6366f1' : '#334155',
        color: active ? '#fff' : '#94a3b8', borderRadius: 6, padding: '6px 14px',
        cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6
      }}>
      <span style={{ textTransform: 'capitalize' }}>{label}</span>
      <span style={{ background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>
    </button>
  );
};

const AccountRow = ({ account: a, onView, onSuspend, onTerminate }: { account: Account; onView: (id: string) => void; onSuspend: (a: Account) => void; onTerminate: (a: Account) => void }) => {
  const [hover, setHover] = useState(false);
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)', background: hover ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
      <td style={{ padding: '12px 16px' }}>
        <button onClick={() => onView(a.id)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 13 }}>{a.username}</button>
      </td>
      <td style={{ padding: '12px 16px', color: '#f1f5f9' }}>{a.primary_domain}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>{a.email}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{a.plan_name || '—'}</td>
      <td style={{ padding: '12px 16px' }}><StatusBadge status={a.status} /></td>
      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>{timeAgo(a.created_at)}</td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn size="sm" variant="ghost" onClick={() => onView(a.id)}><IcoEye size={12} /></Btn>
          <Btn size="sm" variant={a.status === 'suspended' ? 'success' : 'warning'} onClick={() => onSuspend(a)}>
            {a.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => onTerminate(a)}>Terminate</Btn>
        </div>
      </td>
    </tr>
  );
};

// ─── Account Detail View ───────────────────────────────────────────────────────

const AccountDetailView = ({ detail: d, plans, onBack, onSuspend, onTerminate, onChangePlan, onChangePassword }: {
  detail: AccountDetail; plans: Plan[]; onBack: () => void;
  onSuspend: (a: Account) => void; onTerminate: (a: Account) => void;
  onChangePlan: () => void; onChangePassword: () => void;
}) => {
  const planName = d.plan?.name || plans.find(p => p.id === d.plan_id)?.name || 'No Plan';
  const plan = d.plan || plans.find(p => p.id === d.plan_id);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Btn variant="ghost" onClick={onBack}><IcoArrowLeft size={14} /> Back</Btn>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>{d.username}</h2>
            <StatusBadge status={d.status} />
            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{d.role}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>{d.primary_domain}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Account Info */}
        <Card>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Account Information</div>
          <InfoRow label="Email" value={d.email} />
          <InfoRow label="Primary Domain" value={d.primary_domain} />
          <InfoRow label="Home Directory" value={d.home_dir || `/home/${d.username}`} />
          <InfoRow label="Last Login IP" value={d.last_login_ip || 'Unknown'} />
          <InfoRow label="Created" value={new Date(d.created_at).toLocaleDateString()} />
        </Card>

        {/* Plan */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>Hosting Plan</div>
            <Btn size="sm" onClick={onChangePlan}>Change Plan</Btn>
          </div>
          <div style={{ color: '#6366f1', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{planName}</div>
          {plan ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <PlanStat label="Disk" value={fmt(plan.disk_mb, 'B')} />
              <PlanStat label="Bandwidth" value={fmt(plan.bandwidth_mb, 'B')} />
              <PlanStat label="Email Accts" value={String(plan.max_email_accounts)} />
              <PlanStat label="Databases" value={String(plan.max_databases)} />
              <PlanStat label="FTP" value={String(plan.max_ftp_accounts)} />
              <PlanStat label="Addon Domains" value={String(plan.max_addon_domains)} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: 13 }}>No plan assigned</div>}
        </Card>
      </div>

      {/* Usage */}
      {d.usage && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <StatCard label="Email Accounts" value={d.usage.email_accounts} icon={<IcoBox size={18} />} color="#6366f1" />
          <StatCard label="Databases" value={d.usage.databases} icon={<IcoServer size={18} />} color="#22c55e" />
          <StatCard label="FTP Accounts" value={d.usage.ftp_accounts} icon={<IcoKey size={18} />} color="#f59e0b" />
          <StatCard label="Addon Domains" value={d.usage.addon_domains} icon={<IcoGlobe size={18} />} color="#8b5cf6" />
        </div>
      )}

      {/* Actions */}
      <Card>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Account Actions</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Btn variant={d.status === 'suspended' ? 'success' : 'warning'} onClick={() => onSuspend(d)}>
            {d.status === 'suspended' ? 'Unsuspend Account' : 'Suspend Account'}
          </Btn>
          <Btn onClick={onChangePassword}><IcoKey size={14} /> Change Password</Btn>
          <Btn variant="danger" onClick={() => onTerminate(d)}><IcoTrash size={14} /> Terminate Account</Btn>
        </div>
      </Card>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(51,65,85,0.4)', fontSize: 13 }}>
    <span style={{ color: '#94a3b8' }}>{label}</span>
    <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{value}</span>
  </div>
);

const PlanStat = ({ label, value }: { label: string; value: string }) => (
  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 12px' }}>
    <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
    <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>{value}</div>
  </div>
);

// ─── Plans View ────────────────────────────────────────────────────────────────

const PlansView = ({ plans, onEdit, onToggle, onDelete, onCreatePlan }: {
  plans: Plan[]; onEdit: (p: Plan) => void; onToggle: (p: Plan) => void; onDelete: (p: Plan) => void; onCreatePlan: () => void;
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
      <Btn onClick={onCreatePlan}><IcoPlus size={14} /> New Plan</Btn>
    </div>
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #334155' }}>
            {['Name', 'Disk', 'Bandwidth', 'Emails', 'DBs', 'Price/mo', 'Accounts', 'Status', 'Actions'].map(h => (
              <th key={h} style={{ color: '#94a3b8', fontWeight: 600, padding: '12px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plans.length === 0 ? (
            <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No plans found</td></tr>
          ) : plans.map(p => (
            <PlanRow key={p.id} plan={p} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const PlanRow = ({ plan: p, onEdit, onToggle, onDelete }: { plan: Plan; onEdit: (p: Plan) => void; onToggle: (p: Plan) => void; onDelete: (p: Plan) => void }) => {
  const [hover, setHover] = useState(false);
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)', background: hover ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
      <td style={{ padding: '12px 16px', color: '#f1f5f9', fontWeight: 600 }}>{p.name}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{fmt(p.disk_mb, 'B')}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{fmt(p.bandwidth_mb, 'B')}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{p.max_email_accounts}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{p.max_databases}</td>
      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>${Number(p.price_monthly ?? 0).toFixed(2)}</td>
      <td style={{ padding: '12px 16px', color: '#f1f5f9', fontWeight: 600 }}>{p.account_count ?? 0}</td>
      <td style={{ padding: '12px 16px' }}><StatusBadge status={p.is_active ? 'active' : 'suspended'} /></td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn size="sm" variant="ghost" onClick={() => onEdit(p)}><IcoEdit size={12} /></Btn>
          <Btn size="sm" variant={p.is_active ? 'warning' : 'success'} onClick={() => onToggle(p)}>
            {p.is_active ? 'Deactivate' : 'Activate'}
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => onDelete(p)} disabled={(p.account_count || 0) > 0}><IcoTrash size={12} /></Btn>
        </div>
      </td>
    </tr>
  );
};

// ─── DNS View ──────────────────────────────────────────────────────────────────

const DnsView = ({ accounts, authFetch, showToast }: { accounts: Account[]; authFetch: (url: string, opts?: RequestInit) => Promise<Response>; showToast: (msg: string, ok: boolean) => void }) => {
  const [selectedDomain, setSelectedDomain] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const loadRecords = async (domain: string) => {
    if (!domain) return;
    setLoadingRecords(true);
    try {
      const r = await authFetch(`/cpanel/dns/records?domain=${encodeURIComponent(domain)}`);
      if (r.ok) setRecords(await r.json());
      else setRecords([]);
    } catch { setRecords([]); }
    finally { setLoadingRecords(false); }
  };

  const handleSelect = (domain: string) => {
    setSelectedDomain(domain);
    loadRecords(domain);
  };

  const handleDelete = async (recordId: string) => {
    const r = await authFetch(`/cpanel/dns/records/${recordId}`, { method: 'DELETE' });
    if (r.ok) { showToast('Record deleted', true); loadRecords(selectedDomain); }
    else showToast('Failed to delete record', false);
  };

  const uniqueDomains = [...new Set(accounts.map(a => a.primary_domain).filter(Boolean))];

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
          Select an account domain to view and manage its DNS zone records.
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            style={{ ...inputStyle, maxWidth: 360 }}
            value={selectedDomain}
            onChange={e => handleSelect(e.target.value)}>
            <option value="">Select a domain...</option>
            {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {selectedDomain && (
            <Btn variant="ghost" size="sm" onClick={() => loadRecords(selectedDomain)}>
              <IcoRefresh size={13} /> Refresh
            </Btn>
          )}
        </div>
      </Card>

      {selectedDomain && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>DNS Zone: {selectedDomain}</span>
            {loadingRecords && <span style={{ color: '#94a3b8', fontSize: 13 }}>Loading...</span>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #334155' }}>
                {['Name', 'Type', 'Value', 'TTL', 'Actions'].map(h => (
                  <th key={h} style={{ color: '#94a3b8', fontWeight: 600, padding: '10px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>{loadingRecords ? 'Loading records...' : 'No DNS records found'}</td></tr>
              ) : records.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                  <td style={{ padding: '10px 16px', color: '#f1f5f9' }}>{r.name}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{r.type}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{r.ttl}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Btn size="sm" variant="danger" onClick={() => handleDelete(r.id)}><IcoTrash size={12} /></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

// ─── Server Status View ────────────────────────────────────────────────────────

const ServerStatusView = ({ serviceStatus, stats, onRefresh }: { serviceStatus: ServiceStatus | null; stats: Stats | null; onRefresh: () => void }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
      <Btn variant="ghost" onClick={onRefresh}><IcoRefresh size={14} /> Refresh</Btn>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
      {[
        { key: 'mysql', name: 'MySQL Database', desc: 'Primary database server for all account data and email configurations.' },
        { key: 'redis', name: 'Redis Cache', desc: 'In-memory cache for sessions, rate limiting, and performance acceleration.' },
        { key: 'api', name: 'API Server', desc: 'Fastify backend serving all cPanel and WHM API endpoints.' },
      ].map(s => {
        const svc = serviceStatus?.[s.key as keyof ServiceStatus] as { online: boolean; latency?: number } | undefined;
        const online = svc?.online ?? false;
        return (
          <Card key={s.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, background: online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: online ? '#22c55e' : '#ef4444' }}>
                <IcoServer size={20} />
              </div>
              <div>
                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#22c55e' : '#ef4444', boxShadow: `0 0 6px ${online ? '#22c55e' : '#ef4444'}` }} />
                  <span style={{ color: online ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: 600 }}>{online ? 'Online' : 'Offline'}</span>
                  {svc?.latency !== undefined && <span style={{ color: '#64748b', fontSize: 12 }}>• {svc.latency}ms</span>}
                </div>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
          </Card>
        );
      })}
    </div>

    {stats && (
      <Card>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Resource Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Total Accounts', value: stats.accounts },
            { label: 'Suspended', value: stats.suspended },
            { label: 'Email Accounts', value: stats.emails },
            { label: 'Databases', value: stats.databases },
            { label: 'FTP Accounts', value: stats.ftp_accounts },
            { label: 'Domains', value: stats.domains },
            { label: 'Plans', value: stats.plans },
            { label: 'Provisioning', value: stats.provisioning },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
              <div style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </Card>
    )}
  </div>
);

// ─── Resellers View ────────────────────────────────────────────────────────────

const ResellersView = ({ resellers, onView, onSuspend, onTerminate }: {
  resellers: Account[]; onView: (id: string) => void; onSuspend: (a: Account) => void; onTerminate: (a: Account) => void;
}) => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>
        Accounts with the <strong style={{ color: '#6366f1' }}>reseller</strong> role. To promote a user to reseller, change their role via the account detail panel.
      </div>
    </div>
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #334155' }}>
            {['Username', 'Primary Domain', 'Email', 'Status', 'Created', 'Actions'].map(h => (
              <th key={h} style={{ color: '#94a3b8', fontWeight: 600, padding: '12px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resellers.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No reseller accounts found</td></tr>
          ) : resellers.map(a => (
            <AccountRow key={a.id} account={a} onView={onView} onSuspend={onSuspend} onTerminate={onTerminate} />
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

// ─── Activity View ─────────────────────────────────────────────────────────────

const ActivityView = ({ activity, onRefresh }: { activity: ActivityEntry[]; onRefresh: () => void }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
      <Btn variant="ghost" onClick={onRefresh}><IcoRefresh size={14} /> Refresh</Btn>
    </div>
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #334155' }}>
            {['Username', 'Domain', 'Status', 'Time'].map(h => (
              <th key={h} style={{ color: '#94a3b8', fontWeight: 600, padding: '12px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activity.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No recent activity</td></tr>
          ) : activity.map((a, i) => (
            <tr key={a.id || i} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
              <td style={{ padding: '12px 16px', color: '#f1f5f9', fontWeight: 500 }}>{a.username}</td>
              <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{a.domain}</td>
              <td style={{ padding: '12px 16px' }}><StatusBadge status={a.status} /></td>
              <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>{timeAgo(a.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

// ─── Create Account Modal ──────────────────────────────────────────────────────

const CreateAccountModal = ({ plans, onClose, onSuccess, authFetch, showToast }: {
  plans: Plan[]; onClose: () => void; onSuccess: () => void;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>; showToast: (m: string, ok: boolean) => void;
}) => {
  const [form, setForm] = useState({ username: '', email: '', password: '', domain: '', planId: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/whm/accounts', { method: 'POST', body: JSON.stringify({ ...form, serverId: 'auto' }) });
      const data = await r.json();
      if (r.ok) onSuccess();
      else showToast(data.error || 'Failed to create account', false);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Create Hosting Account" onClose={onClose}>
      <Field label="Username"><input style={inputStyle} value={form.username} onChange={set('username')} placeholder="username" /></Field>
      <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="user@example.com" /></Field>
      <Field label="Password"><input style={inputStyle} type="password" value={form.password} onChange={set('password')} placeholder="••••••••" /></Field>
      <Field label="Primary Domain"><input style={inputStyle} value={form.domain} onChange={set('domain')} placeholder="example.com" /></Field>
      <Field label="Hosting Plan">
        <select style={inputStyle} value={form.planId} onChange={set('planId')}>
          <option value="">Select a plan...</option>
          {plans.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Role">
        <select style={inputStyle} value={form.role} onChange={set('role')}>
          <option value="user">User</option>
          <option value="reseller">Reseller</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</Btn>
      </div>
    </Modal>
  );
};

// ─── Create Plan Modal ─────────────────────────────────────────────────────────

const planDefaults = { name: '', disk_mb: 10240, bandwidth_mb: 102400, max_email_accounts: 50, max_databases: 10, max_ftp_accounts: 10, max_addon_domains: 5, price_monthly: 9.99 };

const CreatePlanModal = ({ onClose, onSuccess, authFetch, showToast }: {
  onClose: () => void; onSuccess: () => void;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>; showToast: (m: string, ok: boolean) => void;
}) => {
  const [form, setForm] = useState(planDefaults);
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: k === 'name' ? e.target.value : Number(e.target.value) }));

  const submit = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/whm/plans', { method: 'POST', body: JSON.stringify(form) });
      const data = await r.json();
      if (r.ok) onSuccess();
      else showToast(data.error || 'Failed to create plan', false);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Create Hosting Plan" onClose={onClose} width={540}>
      <Field label="Plan Name"><input style={inputStyle} value={form.name} onChange={set('name')} placeholder="Starter, Pro, Business..." /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Disk Quota (MB)"><input style={inputStyle} type="number" value={form.disk_mb} onChange={set('disk_mb')} /></Field>
        <Field label="Bandwidth (MB)"><input style={inputStyle} type="number" value={form.bandwidth_mb} onChange={set('bandwidth_mb')} /></Field>
        <Field label="Max Email Accounts"><input style={inputStyle} type="number" value={form.max_email_accounts} onChange={set('max_email_accounts')} /></Field>
        <Field label="Max Databases"><input style={inputStyle} type="number" value={form.max_databases} onChange={set('max_databases')} /></Field>
        <Field label="Max FTP Accounts"><input style={inputStyle} type="number" value={form.max_ftp_accounts} onChange={set('max_ftp_accounts')} /></Field>
        <Field label="Max Addon Domains"><input style={inputStyle} type="number" value={form.max_addon_domains} onChange={set('max_addon_domains')} /></Field>
        <Field label="Price / Month ($)"><input style={inputStyle} type="number" step="0.01" value={form.price_monthly} onChange={set('price_monthly')} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Plan'}</Btn>
      </div>
    </Modal>
  );
};

// ─── Edit Plan Modal ───────────────────────────────────────────────────────────

const EditPlanModal = ({ plan, onClose, onSuccess, authFetch, showToast }: {
  plan: Plan; onClose: () => void; onSuccess: () => void;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>; showToast: (m: string, ok: boolean) => void;
}) => {
  const [form, setForm] = useState({
    name: plan.name,
    disk_mb: plan.disk_mb,
    bandwidth_mb: plan.bandwidth_mb,
    max_email_accounts: plan.max_email_accounts,
    max_databases: plan.max_databases,
    max_ftp_accounts: plan.max_ftp_accounts,
    max_addon_domains: plan.max_addon_domains,
    price_monthly: Number(plan.price_monthly ?? 0),
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: k === 'name' ? e.target.value : Number(e.target.value) }));

  const submit = async () => {
    setLoading(true);
    try {
      const r = await authFetch(`/whm/plans/${plan.id}`, { method: 'PUT', body: JSON.stringify(form) });
      const data = await r.json();
      if (r.ok) onSuccess();
      else showToast(data.error || 'Failed to update plan', false);
    } finally { setLoading(false); }
  };

  return (
    <Modal title={`Edit Plan: ${plan.name}`} onClose={onClose} width={540}>
      <Field label="Plan Name"><input style={inputStyle} value={form.name} onChange={set('name')} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Disk Quota (MB)"><input style={inputStyle} type="number" value={form.disk_mb} onChange={set('disk_mb')} /></Field>
        <Field label="Bandwidth (MB)"><input style={inputStyle} type="number" value={form.bandwidth_mb} onChange={set('bandwidth_mb')} /></Field>
        <Field label="Max Email Accounts"><input style={inputStyle} type="number" value={form.max_email_accounts} onChange={set('max_email_accounts')} /></Field>
        <Field label="Max Databases"><input style={inputStyle} type="number" value={form.max_databases} onChange={set('max_databases')} /></Field>
        <Field label="Max FTP Accounts"><input style={inputStyle} type="number" value={form.max_ftp_accounts} onChange={set('max_ftp_accounts')} /></Field>
        <Field label="Max Addon Domains"><input style={inputStyle} type="number" value={form.max_addon_domains} onChange={set('max_addon_domains')} /></Field>
        <Field label="Price / Month ($)"><input style={inputStyle} type="number" step="0.01" value={form.price_monthly} onChange={set('price_monthly')} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Btn>
      </div>
    </Modal>
  );
};

// ─── Change Plan Modal ─────────────────────────────────────────────────────────

const ChangePlanModal = ({ account, plans, onClose, onSuccess, authFetch, showToast }: {
  account: AccountDetail; plans: Plan[]; onClose: () => void; onSuccess: () => void;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>; showToast: (m: string, ok: boolean) => void;
}) => {
  const [planId, setPlanId] = useState(account.plan_id || '');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!planId) { showToast('Please select a plan', false); return; }
    setLoading(true);
    try {
      const r = await authFetch(`/whm/accounts/${account.id}/change-plan`, { method: 'POST', body: JSON.stringify({ planId }) });
      const data = await r.json();
      if (r.ok) onSuccess();
      else showToast(data.error || 'Failed to change plan', false);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Change Hosting Plan" onClose={onClose} width={400}>
      <p style={{ color: '#94a3b8', marginTop: 0, fontSize: 14 }}>Select a new plan for <strong style={{ color: '#f1f5f9' }}>{account.username}</strong></p>
      <Field label="New Plan">
        <select style={inputStyle} value={planId} onChange={e => setPlanId(e.target.value)}>
          <option value="">Select a plan...</option>
          {plans.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.disk_mb, 'B')} disk</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={loading}>{loading ? 'Changing...' : 'Change Plan'}</Btn>
      </div>
    </Modal>
  );
};

// ─── Change Password Modal ─────────────────────────────────────────────────────

const ChangePasswordModal = ({ account, onClose, onSuccess, authFetch, showToast }: {
  account: AccountDetail; onClose: () => void; onSuccess: () => void;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>; showToast: (m: string, ok: boolean) => void;
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) { showToast('Password must be at least 6 characters', false); return; }
    if (password !== confirm) { showToast('Passwords do not match', false); return; }
    setLoading(true);
    try {
      const r = await authFetch(`/whm/accounts/${account.id}/change-password`, { method: 'POST', body: JSON.stringify({ password }) });
      const data = await r.json();
      if (r.ok) onSuccess();
      else showToast(data.error || 'Failed to change password', false);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Change Password" onClose={onClose} width={400}>
      <p style={{ color: '#94a3b8', marginTop: 0, fontSize: 14 }}>Set a new password for <strong style={{ color: '#f1f5f9' }}>{account.username}</strong></p>
      <Field label="New Password"><input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></Field>
      <Field label="Confirm Password"><input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" /></Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Change Password'}</Btn>
      </div>
    </Modal>
  );
};
