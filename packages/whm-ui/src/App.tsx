import { useState, useEffect } from 'react';

const API = '';

interface Account {
  id: string;
  username: string;
  primary_domain: string;
  email: string;
  status: 'active' | 'suspended' | 'terminated' | 'provisioning';
  role: string;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  disk_mb: number;
  bandwidth_mb: number;
  max_email_accounts: number;
  max_databases: number;
  price_monthly: number;
  is_active: boolean;
}

interface Stats {
  accounts: number;
  domains: number;
  emails: number;
}

type View = 'accounts' | 'plans' | 'stats';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<View>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Create account modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [creating, setCreating] = useState(false);

  // Create plan modal
  const [showPlan, setShowPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDisk, setPlanDisk] = useState('10240');
  const [planBw, setPlanBw] = useState('102400');
  const [planEmail, setPlanEmail] = useState('50');
  const [planDbs, setPlanDbs] = useState('20');
  const [planPrice, setPlanPrice] = useState('0');

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const headers = () => ({ 'Content-Type': 'application/json', 'x-whm-api-token': token || '' });

  const loadAccounts = async (tok: string) => {
    const res = await fetch(`${API}/whm/accounts`, { headers: { 'x-whm-api-token': tok } });
    if (res.ok) setAccounts(await res.json());
  };

  const loadPlans = async (tok: string) => {
    const res = await fetch(`${API}/whm/plans`, { headers: { 'x-whm-api-token': tok } });
    if (res.ok) setPlans(await res.json());
  };

  const loadStats = async (tok: string) => {
    const res = await fetch(`${API}/whm/stats`, { headers: { 'x-whm-api-token': tok } });
    if (res.ok) setStats(await res.json());
  };

  useEffect(() => {
    const init = async () => {
      const envToken = import.meta.env.VITE_WHM_TOKEN || (window as Record<string, unknown>)['WHM_TOKEN'] as string;
      const apiKey = envToken || 'default-whm-key';
      setToken(apiKey);
      try {
        await Promise.all([loadAccounts(apiKey), loadPlans(apiKey), loadStats(apiKey)]);
      } catch {
        // API unreachable — show empty state rather than hanging spinner
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSuspend = async (acc: Account) => {
    if (!confirm(`Suspend ${acc.username}?`)) return;
    const res = await fetch(`${API}/whm/accounts/${acc.id}/suspend`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ reason: 'Suspended by admin' })
    });
    if (res.ok) { notify(`${acc.username} suspended`); await loadAccounts(token!); }
    else notify('Failed to suspend', false);
  };

  const handleUnsuspend = async (acc: Account) => {
    const res = await fetch(`${API}/whm/accounts/${acc.id}/unsuspend`, {
      method: 'POST', headers: headers(), body: JSON.stringify({})
    });
    if (res.ok) { notify(`${acc.username} unsuspended`); await loadAccounts(token!); }
    else notify('Failed to unsuspend', false);
  };

  const handleTerminate = async (acc: Account) => {
    if (!confirm(`TERMINATE and permanently delete ${acc.username}? This cannot be undone.`)) return;
    const res = await fetch(`${API}/whm/accounts/${acc.id}`, { method: 'DELETE', headers: headers() });
    if (res.ok) { notify(`${acc.username} terminated`); await loadAccounts(token!); }
    else notify('Failed to terminate', false);
  };

  const handleCreateAccount = async () => {
    if (!newUsername || !newDomain || !newEmail || !newPlanId) {
      notify('All fields required', false); return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API}/whm/accounts`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ serverId: 'auto', planId: newPlanId, username: newUsername, domain: newDomain, email: newEmail, password: newPassword || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        notify(`Account ${newUsername} created (provisioning)`);
        setShowCreate(false);
        setNewUsername(''); setNewDomain(''); setNewEmail(''); setNewPassword(''); setNewPlanId('');
        await loadAccounts(token!);
      } else { notify(data.error || 'Failed to create account', false); }
    } finally { setCreating(false); }
  };

  const handleCreatePlan = async () => {
    if (!planName) { notify('Plan name required', false); return; }
    const res = await fetch(`${API}/whm/plans`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ name: planName, disk_mb: parseInt(planDisk), bandwidth_mb: parseInt(planBw), max_email_accounts: parseInt(planEmail), max_databases: parseInt(planDbs), max_ftp_accounts: 20, max_subdomains: 20, max_addon_domains: 10, max_cron_jobs: 20, price_monthly: parseFloat(planPrice) })
    });
    if (res.ok) {
      notify(`Plan "${planName}" created`);
      setShowPlan(false);
      setPlanName(''); setPlanDisk('10240'); setPlanBw('102400'); setPlanEmail('50'); setPlanDbs('20'); setPlanPrice('0');
      await loadPlans(token!);
    } else { notify('Failed to create plan', false); }
  };

  const filteredAccounts = accounts.filter(a =>
    a.username.includes(search) || a.primary_domain.includes(search) || a.email.includes(search)
  );

  if (loading) {
    return <div className="loading"><div className="spinner" /><span>Loading WHM...</span></div>;
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>W<span>H</span>M</h1>
          <p>Web Host Manager</p>
        </div>
        <nav className="nav">
          {([
            ['accounts', 'Hosting Accounts', <IconAccounts />],
            ['plans',    'Plans / Packages', <IconPlans />],
            ['stats',    'Server Stats',     <IconStats />],
          ] as [View, string, JSX.Element][]).map(([v, label, icon]) => (
            <div key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {icon} {label}
            </div>
          ))}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--whm-border)', fontSize: '11px', color: 'var(--whm-muted)' }}>
          cPanel Clone WHM v1.0
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <div className="topbar">
          <span className="topbar-title">{view === 'accounts' ? 'Hosting Accounts' : view === 'plans' ? 'Plans & Packages' : 'Server Statistics'}</span>
          <div className="topbar-user">
            <span className="badge badge-admin">Root Admin</span>
            <span>WHM Portal</span>
          </div>
        </div>

        <div className="content">
          {/* Stats row */}
          {stats && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="label">Total Accounts</div>
                <div className="value">{stats.accounts}</div>
                <div className="sub">hosting accounts</div>
              </div>
              <div className="stat-card">
                <div className="label">Active Domains</div>
                <div className="value">{stats.domains}</div>
                <div className="sub">addon + primary</div>
              </div>
              <div className="stat-card">
                <div className="label">Email Accounts</div>
                <div className="value">{stats.emails}</div>
                <div className="sub">across all accounts</div>
              </div>
              <div className="stat-card">
                <div className="label">Plans Available</div>
                <div className="value">{plans.filter(p => p.is_active).length}</div>
                <div className="sub">active packages</div>
              </div>
            </div>
          )}

          {/* Accounts view */}
          {view === 'accounts' && (
            <div className="section-card">
              <div className="section-header">
                <h2>Hosting Accounts</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input className="search-bar" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} />
                  <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create Account</button>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Domain</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--whm-muted)', padding: '32px' }}>No accounts found.</td></tr>
                  ) : filteredAccounts.map(acc => (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 600 }}>{acc.username}</td>
                      <td style={{ color: 'var(--whm-muted)' }}>{acc.primary_domain}</td>
                      <td style={{ color: 'var(--whm-muted)', fontSize: '12px' }}>{acc.email}</td>
                      <td><span className={`status status-${acc.status}`}>{acc.status}</span></td>
                      <td style={{ color: 'var(--whm-muted)', fontSize: '12px' }}>{new Date(acc.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {acc.status === 'active' ? (
                            <button className="btn btn-sm btn-danger" onClick={() => handleSuspend(acc)}>Suspend</button>
                          ) : acc.status === 'suspended' ? (
                            <button className="btn btn-sm btn-success" onClick={() => handleUnsuspend(acc)}>Unsuspend</button>
                          ) : null}
                          <button className="btn btn-sm btn-danger" style={{ opacity: 0.7 }} onClick={() => handleTerminate(acc)}>Terminate</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Plans view */}
          {view === 'plans' && (
            <div className="section-card">
              <div className="section-header">
                <h2>Hosting Plans</h2>
                <button className="btn btn-primary" onClick={() => setShowPlan(true)}>+ New Plan</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Disk</th>
                    <th>Bandwidth</th>
                    <th>Email Accounts</th>
                    <th>Databases</th>
                    <th>Price/mo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--whm-muted)', padding: '32px' }}>No plans. Create one.</td></tr>
                  ) : plans.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{(p.disk_mb / 1024).toFixed(0)} GB</td>
                      <td>{(p.bandwidth_mb / 1024).toFixed(0)} GB</td>
                      <td>{p.max_email_accounts === -1 ? 'Unlimited' : p.max_email_accounts}</td>
                      <td>{p.max_databases === -1 ? 'Unlimited' : p.max_databases}</td>
                      <td>{p.price_monthly > 0 ? `$${p.price_monthly}/mo` : 'Free'}</td>
                      <td><span className={`status ${p.is_active ? 'status-active' : 'status-suspended'}`}>{p.is_active ? 'active' : 'inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats view */}
          {view === 'stats' && stats && (
            <div className="section-card">
              <div className="section-header"><h2>Server Overview</h2></div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {[
                  ['Total Hosting Accounts', stats.accounts],
                  ['Total Domains (Addon + Primary)', stats.domains],
                  ['Total Email Accounts', stats.emails],
                  ['Total Plans', plans.length],
                  ['Active Plans', plans.filter(p => p.is_active).length],
                  ['Active Accounts', accounts.filter(a => a.status === 'active').length],
                  ['Suspended Accounts', accounts.filter(a => a.status === 'suspended').length],
                  ['Provisioning Accounts', accounts.filter(a => a.status === 'provisioning').length],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--whm-border)' }}>
                    <span style={{ color: 'var(--whm-muted)', fontSize: '13px' }}>{label}</span>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h3>Create Hosting Account</h3>
              <button className="close-x" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Username</label>
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="johndoe" />
                </div>
                <div className="form-group">
                  <label>Primary Domain</label>
                  <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="johndoe.com" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Email</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@example.com" />
                </div>
                <div className="form-group">
                  <label>Password (optional)</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="auto-generate if empty" />
                </div>
              </div>
              <div className="form-group">
                <label>Plan</label>
                <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)}>
                  <option value="">— select plan —</option>
                  {plans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({(p.disk_mb / 1024).toFixed(0)} GB disk)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateAccount} disabled={creating}>
                {creating ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showPlan && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h3>Create Hosting Plan</h3>
              <button className="close-x" onClick={() => setShowPlan(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Plan Name</label>
                <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. Starter" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Disk (MB)</label>
                  <input type="number" value={planDisk} onChange={e => setPlanDisk(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Bandwidth (MB)</label>
                  <input type="number" value={planBw} onChange={e => setPlanBw(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Max Email Accounts</label>
                  <input type="number" value={planEmail} onChange={e => setPlanEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Max Databases</label>
                  <input type="number" value={planDbs} onChange={e => setPlanDbs(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Price / Month ($)</label>
                <input type="number" step="0.01" value={planPrice} onChange={e => setPlanPrice(e.target.value)} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowPlan(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreatePlan}>Create Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}
    </div>
  );
}

function IconAccounts() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function IconPlans() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}

function IconStats() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
}
