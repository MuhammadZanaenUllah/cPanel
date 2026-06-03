import { useState, useEffect, lazy, Suspense } from 'react';
import './App.css';

// xterm.js terminal — loaded as a separate chunk so Vite doesn't try to
// resolve its imports during App.tsx analysis
const XtermTerminal = lazy(() => import('./XtermTerminal'));

const API_BASE = 'http://localhost:3000';

interface EmailAccount {
  id: string;
  local_part: string;
  domain: string;
  quota_mb: number;
}

interface DomainRecord {
  id: string;
  domain: string;
  document_root: string;
  is_primary: boolean;
}

interface FileItem {
  name: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
  relPath: string;
  permissions?: string;
}

interface ForwarderRecord {
  id: string;
  source: string;
  destination: string;
}


export default function App() {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarSections, setSidebarSections] = useState<Record<string, boolean>>({
    email: true, files: true, db: true, domains: true, metrics: true, security: true, advanced: true
  });

  // Dynamic domains list (defaulting strictly to the seeded testuser domain to prevent blank falls)
  const [domains, setDomains] = useState<DomainRecord[]>([
    { id: '1', domain: 'testuserdomain.com', document_root: '/home/testuser/public_html', is_primary: true }
  ]);
  const primaryDomainName = domains.find(d => d.is_primary)?.domain || 'testuserdomain.com';
  const [emails, setEmails] = useState<EmailAccount[]>([
    { id: '1', local_part: 'info', domain: 'testuserdomain.com', quota_mb: 1024 }
  ]);
  const [databases, setDatabases] = useState<string[]>(['testuser_production', 'testuser_staging']);
  const [ftpAccounts, setFtpAccounts] = useState<string[]>(['testuser_deploy']);
  const [forwarders, setForwarders] = useState<ForwarderRecord[]>([
    { id: '1', source: 'contact@testuserdomain.com', destination: 'mybackup@gmail.com' }
  ]);

  const [emailRoutings, setEmailRoutings] = useState<{ domain: string; routing_type: string }[]>([]);
  const [autoresponders, setAutoresponders] = useState<{ id: string; email: string; from_name: string; subject: string; body: string; interval_hours: number }[]>([]);

  // Autoresponder Form states
  const [autoEmailLocal, setAutoEmailLocal] = useState('');
  const [autoFromName, setAutoFromName] = useState('');
  const [autoSubject, setAutoSubject] = useState('');
  const [autoBody, setAutoBody] = useState('');
  const [autoInterval, setAutoInterval] = useState(1);
  const [editingAutoresponder, setEditingAutoresponder] = useState<any | null>(null);

  // Routing settings state
  const [selectedRoutingDomain, setSelectedRoutingDomain] = useState('testuserdomain.com');
  const [selectedRoutingType, setSelectedRoutingType] = useState('local');

  // New advanced features states
  const [workspaceImages, setWorkspaceImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [scaleWidth, setScaleWidth] = useState(800);
  const [scaleHeight, setScaleHeight] = useState(600);

  const [diskUsage, setDiskUsage] = useState<{ totalBytes: number; breakdown: any[] }>({ totalBytes: 0, breakdown: [] });

  const [redirects, setRedirects] = useState<any[]>([]);
  const [redirectDomain, setRedirectDomain] = useState('testuserdomain.com');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [redirectType, setRedirectType] = useState('301');

  const [visitors, setVisitors] = useState<any[]>([]);
  const [bandwidth, setBandwidth] = useState<any[]>([]);
  const [serverIp, setServerIp] = useState<string>('—');
  const [lastLoginIp, setLastLoginIp] = useState<string>('—');
  const [accountPlan, setAccountPlan] = useState<{ plan: any; usage: any } | null>(null);
  const [webmailAccount, _setWebmailAccount] = useState<string | null>(null);
  const [_webmailTab, _setWebmailTab] = useState<'inbox' | 'compose' | 'sent'>('inbox');
  const [_webmailCompose, _setWebmailCompose] = useState({ to: '', subject: '', body: '' });
  const [_webmailInbox, _setWebmailInbox] = useState<any[]>([]);
  const [_webmailSent, _setWebmailSent] = useState<any[]>([]);
  const [_webmailLoading, _setWebmailLoading] = useState(false);
  const [_webmailSending, _setWebmailSending] = useState(false);
  const [_smtpConfig, _setSmtpConfig] = useState<{ isMailhog?: boolean; host?: string; port?: number } | null>(null);

  // File Manager states
  const [currentPath, setCurrentPath] = useState<string>('public_html');
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [editingFile, setEditingFile] = useState<{ name: string; relPath: string; content: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [selectedFileItem, setSelectedFileItem] = useState<FileItem | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameNewName, setRenameNewName] = useState('');
  const [showChmodDialog, setShowChmodDialog] = useState(false);
  const [chmodValue, setChmodValue] = useState('0644');
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyDest, setCopyDest] = useState('');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveDest, setMoveDest] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileContent, setUploadFileContent] = useState('');
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string } | null>(null);

  // SSL/TLS states
  const [sslStatusList, setSslStatusList] = useState<{ domain: string; issuer: string; expires_at: string }[]>([]);

  // DNS Zone Editor states
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [dnsSelectedDomain, setDnsSelectedDomain] = useState('');
  const [dnsNewName, setDnsNewName] = useState('');
  const [dnsNewType, setDnsNewType] = useState('A');
  const [dnsNewContent, setDnsNewContent] = useState('');
  const [dnsNewTtl, setDnsNewTtl] = useState(3600);
  const [dnsNewPriority, setDnsNewPriority] = useState(10);

  // Cron Jobs states
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [cronMinute, setCronMinute] = useState('*');
  const [cronHour, setCronHour] = useState('*');
  const [cronDay, setCronDay] = useState('*');
  const [cronMonth, setCronMonth] = useState('*');
  const [cronWeekday, setCronWeekday] = useState('*');
  const [cronCommand, setCronCommand] = useState('');

  // Backups states
  const [backups, setBackups] = useState<any[]>([]);

  // MySQL Users states
  const [mysqlUsers, setMysqlUsers] = useState<string[]>([]);
  const [newMysqlUser, setNewMysqlUser] = useState('');
  const [newMysqlUserPass, setNewMysqlUserPass] = useState('');
  const [assignDb, setAssignDb] = useState('');
  const [assignUser, setAssignUser] = useState('');

  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal Form states
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newDomain, setNewDomain] = useState('');
  // newDocRoot used in domain creation form
  const [newDb, setNewDb] = useState('');
  const [newFtp, setNewFtp] = useState('');
  const [selectedMailDomain, setSelectedMailDomain] = useState('');

  // Forwarder Form states
  const [fwdSource, setFwdSource] = useState('');
  const [fwdDest, setFwdDest] = useState('');

  // WordPress management states
  interface WordPressInstallation {
    id: string;
    domain: string;
    path: string;
    site_title: string;
    admin_user: string;
    db_name: string;
    version: string;
    status: string;
    created_at: string;
  }
  const [wpInstallations, setWpInstallations] = useState<WordPressInstallation[]>([]);
  const [wpDomain, setWpDomain] = useState('');
  const [wpInstallDir, setWpInstallDir] = useState('');
  const [wpSiteTitle, setWpSiteTitle] = useState('My WordPress Site');
  const [wpAdminUser, setWpAdminUser] = useState('admin');
  const [wpAdminPass, setWpAdminPass] = useState('admin123');
  const [wpAdminEmail, setWpAdminEmail] = useState('admin@example.com');
  const [showWpInstallDialog, setShowWpInstallDialog] = useState(false);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // 1. Fetch Dev Token and load all live daemon resources
  const fetchAllData = async (jwtToken: string) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtToken}`
      };

      // Load WordPress Installations
      const wpRes = await fetch(`${API_BASE}/cpanel/wordpress/installations`, { headers });
      if (wpRes.ok) {
        setWpInstallations(await wpRes.json());
      }

      // Load Domains
      const domRes = await fetch(`${API_BASE}/cpanel/domains`, { headers });
      if (domRes.ok) {
        const data = await domRes.json();
        setDomains(data);
        if (data.length > 0) {
          setSelectedMailDomain(data[0].domain);
          setSelectedRoutingDomain(data[0].domain);
        }
      }

      // Load Mail accounts
      const mailRes = await fetch(`${API_BASE}/cpanel/mail`, { headers });
      if (mailRes.ok) {
        const data = await mailRes.json();
        setEmails(data);
      }

      // Load Databases
      const dbRes = await fetch(`${API_BASE}/cpanel/mysql/databases`, { headers });
      if (dbRes.ok) {
        const data = await dbRes.json();
        setDatabases(data.map((d: any) => d.db_name));
      }

      // Load FTP accounts
      const ftpRes = await fetch(`${API_BASE}/cpanel/ftp`, { headers });
      if (ftpRes.ok) {
        const data = await ftpRes.json();
        setFtpAccounts(data.map((f: any) => f.username));
      }

      // Load SSL status
      const sslRes = await fetch(`${API_BASE}/cpanel/ssl`, { headers });
      if (sslRes.ok) {
        setSslStatusList(await sslRes.json());
      }

      // Load Forwarders
      const fwdRes = await fetch(`${API_BASE}/cpanel/mail/forwarders`, { headers });
      if (fwdRes.ok) {
        setForwarders(await fwdRes.json());
      }

      // Load Routing
      const routingRes = await fetch(`${API_BASE}/cpanel/mail/routing`, { headers });
      if (routingRes.ok) {
        const routeData = await routingRes.json();
        setEmailRoutings(routeData);
      }

      // Load Autoresponders
      const autoRes = await fetch(`${API_BASE}/cpanel/mail/autoresponders`, { headers });
      if (autoRes.ok) {
        setAutoresponders(await autoRes.json());
      }

      // Load Redirects
      const redirectRes = await fetch(`${API_BASE}/cpanel/domains/redirects`, { headers });
      if (redirectRes.ok) {
        setRedirects(await redirectRes.json());
      }

      // Load Disk Usage
      const diskRes = await fetch(`${API_BASE}/cpanel/metrics/disk-usage`, { headers });
      if (diskRes.ok) {
        setDiskUsage(await diskRes.json());
      }

      // Load Visitors
      const visitorsRes = await fetch(`${API_BASE}/cpanel/metrics/visitors`, { headers });
      if (visitorsRes.ok) {
        setVisitors(await visitorsRes.json());
      }

      // Load Bandwidth
      const bwRes = await fetch(`${API_BASE}/cpanel/metrics/bandwidth`, { headers });
      if (bwRes.ok) {
        setBandwidth(await bwRes.json());
      }

      // Load Images list
      const imgRes = await fetch(`${API_BASE}/cpanel/images/list`, { headers });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        setWorkspaceImages(imgData.images);
      }

      // Load Cron Jobs
      const cronRes = await fetch(`${API_BASE}/cpanel/cron`, { headers });
      if (cronRes.ok) {
        setCronJobs(await cronRes.json());
      }

      // Load Backups
      const backupRes = await fetch(`${API_BASE}/cpanel/backups`, { headers });
      if (backupRes.ok) {
        setBackups(await backupRes.json());
      }

      // Load MySQL Users
      const mysqlUsersRes = await fetch(`${API_BASE}/cpanel/mysql/users`, { headers });
      if (mysqlUsersRes.ok) {
        const users = await mysqlUsersRes.json();
        setMysqlUsers(users.map((u: any) => u.username));
      }

      // Load account info (real server IP + last login IP)
      const infoRes = await fetch(`${API_BASE}/cpanel/account/info`, { headers });
      if (infoRes.ok) {
        const info = await infoRes.json();
        setServerIp(info.serverIp || '—');
        setLastLoginIp(info.lastLoginIp || '—');
      }

      // Load plan limits + usage counts
      const planRes = await fetch(`${API_BASE}/cpanel/account/plan`, { headers });
      if (planRes.ok) setAccountPlan(await planRes.json());

      // Load SMTP config
      const smtpRes = await fetch(`${API_BASE}/cpanel/mail/smtp-config`, { headers });
      if (smtpRes.ok) _setSmtpConfig(await smtpRes.json());
    } catch (err) {
      console.error("Error loading live data from API:", err);
      triggerToast('Error loading live data from backend', 'error');
    }
  };

  // File explorer fetch
  const fetchFiles = async (relPath: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/list?relPath=${encodeURIComponent(relPath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFilesList(data.items);
        setCurrentPath(data.currentDir);
      } else {
        triggerToast('Failed to load file structure', 'error');
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  };

  const fetchWebmail = async (account?: string | null) => {
    if (!token) return;
    _setWebmailLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const accountParam = account || webmailAccount;
      const inboxUrl = `${API_BASE}/cpanel/mail/inbox${accountParam ? `?account=${encodeURIComponent(accountParam)}` : ''}`;
      const [inboxRes, sentRes] = await Promise.all([
        fetch(inboxUrl, { headers }),
        fetch(`${API_BASE}/cpanel/mail/sent`, { headers }),
      ]);
      if (inboxRes.ok) {
        const d = await inboxRes.json();
        _setWebmailInbox(d.messages || []);
      }
      if (sentRes.ok) {
        _setWebmailSent(await sentRes.json());
      }
    } catch (err) {
      console.error('Error fetching webmail:', err);
    } finally {
      _setWebmailLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/cpanel/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Login failed'); return; }
      localStorage.setItem('cpanel_jwt', data.token);
      setToken(data.token);
      setCurrentUser(data.username);
      setLoading(true);
      await fetchAllData(data.token);
    } catch {
      setLoginError('Cannot reach API on port 3000');
    } finally {
      setLoggingIn(false);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cpanel_jwt');
    setToken(null);
    setCurrentUser('');
  };

  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem('cpanel_jwt');
      if (!stored) { setLoading(false); return; }
      try {
        const res = await fetch(`${API_BASE}/cpanel/domains`, {
          headers: { Authorization: `Bearer ${stored}` }
        });
        if (!res.ok) { localStorage.removeItem('cpanel_jwt'); setLoading(false); return; }
        setToken(stored);
        await fetchAllData(stored);
      } catch {
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);



  // Load page-specific data on navigation
  useEffect(() => {
    if (!token) return;
    if (currentPage === 'filemanager') fetchFiles('public_html');
    if (currentPage === 'webmail') fetchWebmail(webmailAccount);
    if (currentPage === 'dns') {
      const firstDomain = domains[0]?.domain || '';
      if (firstDomain && !dnsSelectedDomain) setDnsSelectedDomain(firstDomain);
      if (firstDomain) fetchDnsRecords(dnsSelectedDomain || firstDomain);
    }
  }, [currentPage, token]);

  const toggleSidebarSection = (id: string) => {
    setSidebarSections(prev => ({ ...prev, [id]: !prev[id] }));
  };


  // --- Live Actions executing on Fastify API ---
  const handleCreateEmail = async () => {
    if (!newUser || !newPass || !token) {
      triggerToast('Please complete all form fields', 'error');
      return;
    }

    const targetDomain = selectedMailDomain || primaryDomainName;

    try {
      const res = await fetch(`${API_BASE}/cpanel/mail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          localPart: newUser,
          domain: targetDomain,
          password: newPass,
          quotaMb: 1024
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Live Mailbox Created: ${newUser}@${targetDomain}`);
        setNewUser('');
        setNewPass('');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to create email', 'error');
      }
    } catch (err) {
      triggerToast('Network error during email creation', 'error');
    }
  };

  const handleCreateForwarder = async () => {
    if (!fwdSource || !fwdDest || !token) {
      triggerToast('Please complete all forwarder fields', 'error');
      return;
    }

    const targetSource = `${fwdSource}@${selectedMailDomain || primaryDomainName}`;

    try {
      const res = await fetch(`${API_BASE}/cpanel/mail/forwarders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          source: targetSource,
          destination: fwdDest
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Email Forwarder created successfully!`);
        setFwdSource('');
        setFwdDest('');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to create forwarder', 'error');
      }
    } catch (err) {
      triggerToast('Network error during forwarder creation', 'error');
    }
  };

  const handleUpdateEmailRouting = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/mail/routing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          domain: selectedRoutingDomain,
          routingType: selectedRoutingType
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`Email routing for ${selectedRoutingDomain} updated to ${selectedRoutingType}!`);
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to update routing', 'error');
      }
    } catch (err) {
      triggerToast('Error updating email routing', 'error');
    }
  };

  const handleCreateOrUpdateAutoresponder = async () => {
    if (!autoEmailLocal || !autoFromName || !autoSubject || !autoBody || !token) {
      triggerToast('Please fill out all autoresponder fields', 'error');
      return;
    }
    const fullEmail = `${autoEmailLocal}@${selectedMailDomain || primaryDomainName}`;
    try {
      const res = await fetch(`${API_BASE}/cpanel/mail/autoresponders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: fullEmail,
          fromName: autoFromName,
          subject: autoSubject,
          body: autoBody,
          intervalHours: autoInterval
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`Autoresponder for ${fullEmail} successfully configured!`);
        setAutoEmailLocal('');
        setAutoFromName('');
        setAutoSubject('');
        setAutoBody('');
        setAutoInterval(1);
        setEditingAutoresponder(null);
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to configure autoresponder', 'error');
      }
    } catch (err) {
      triggerToast('Error configuring autoresponder', 'error');
    }
  };

  const handleDeleteAutoresponder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this autoresponder?') || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/mail/autoresponders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToast('Autoresponder deleted successfully');
        await fetchAllData(token);
      } else {
        triggerToast('Failed to delete autoresponder', 'error');
      }
    } catch (err) {
      triggerToast('Error deleting autoresponder', 'error');
    }
  };

  const handleWordPressInstall = async () => {
    const targetDomain = wpDomain || primaryDomainName;
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/wordpress/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          domain: targetDomain,
          installDir: wpInstallDir,
          siteTitle: wpSiteTitle,
          adminUser: wpAdminUser,
          adminPass: wpAdminPass,
          adminEmail: wpAdminEmail
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('WordPress installed successfully!');
        setShowWpInstallDialog(false);
        setWpInstallDir('');
        setWpSiteTitle('My WordPress Site');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to install WordPress', 'error');
      }
    } catch (err) {
      triggerToast('Error installing WordPress', 'error');
    }
  };

  const handleWordPressUninstall = async (id: string) => {
    if (!confirm('Are you sure you want to completely uninstall this WordPress site? This will drop its database and delete files.') || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/wordpress/uninstall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('WordPress site deleted successfully');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to uninstall WordPress', 'error');
      }
    } catch (err) {
      triggerToast('Error uninstalling WordPress', 'error');
    }
  };

  const handleCreateRedirect = async () => {
    if (!redirectUrl || !token) {
      triggerToast('Destination URL is required', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/cpanel/domains/redirects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          domain: redirectDomain,
          redirectUrl,
          redirectType
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`Domain Redirect configured successfully!`);
        setRedirectUrl('');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to configure redirect', 'error');
      }
    } catch (err) {
      triggerToast('Error configuring redirect', 'error');
    }
  };

  const handleDeleteRedirect = async (id: string) => {
    if (!confirm('Are you sure you want to delete this redirect?') || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/domains/redirects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToast('Redirect deleted successfully');
        await fetchAllData(token);
      } else {
        triggerToast('Failed to delete redirect', 'error');
      }
    } catch (err) {
      triggerToast('Error deleting redirect', 'error');
    }
  };

  const handleResizeImage = async () => {
    if (!selectedImage || !token) return;
    triggerToast('Initiating image scaling process...');
    try {
      const res = await fetch(`${API_BASE}/cpanel/images/resize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          relPath: selectedImage.relPath,
          width: scaleWidth,
          height: scaleHeight
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setSelectedImage(null);
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to scale image', 'error');
      }
    } catch (err) {
      triggerToast('Error scaling image', 'error');
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomain || !token) {
      triggerToast('Domain name cannot be empty', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/cpanel/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          domain: newDomain,
          path: `public_html/${newDomain}`
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Live Addon Domain Registered: ${newDomain}`);
        setNewDomain('');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to add domain', 'error');
      }
    } catch (err) {
      triggerToast('Network error during domain creation', 'error');
    }
  };

  const handleCreateDatabase = async () => {
    if (!newDb || !token) {
      triggerToast('Database name cannot be empty', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/cpanel/mysql/databases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newDb
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Live MySQL Database Created: ${data.dbName}`);
        setNewDb('');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to create database', 'error');
      }
    } catch (err) {
      triggerToast('Network error during database creation', 'error');
    }
  };

  const handleCreateFtp = async () => {
    if (!newFtp || !newPass || !token) {
      triggerToast('Please complete all form fields', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/cpanel/ftp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newFtp,
          password: newPass,
          relativeHomedir: 'public_html',
          quotaMb: 1024
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Live FTP Account Created: ${newFtp}`);
        setNewFtp('');
        setNewPass('');
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to create FTP account', 'error');
      }
    } catch (err) {
      triggerToast('Network error during FTP creation', 'error');
    }
  };

  // File Action execution
  const handleFileActionCreate = async (name: string, isDir: boolean) => {
    if (!name || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: currentPath, name, isDirectory: isDir })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setNewFileName('');
        setNewFolderName('');
        setShowNewFileDialog(false);
        setShowNewFolderDialog(false);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error, 'error');
      }
    } catch (err) {
      triggerToast('Error creating resource', 'error');
    }
  };

  const handleFileActionDelete = async (relPath: string) => {
    if (!confirm('Are you sure you want to delete this file/folder?') || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error, 'error');
      }
    } catch (err) {
      triggerToast('Error deleting resource', 'error');
    }
  };

  const handleFileActionSave = async () => {
    if (!editingFile || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: editingFile.relPath, content: editingFile.content })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setEditingFile(null);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error, 'error');
      }
    } catch (err) {
      triggerToast('Error saving file', 'error');
    }
  };

  const handleFileActionRead = async (item: FileItem, isEdit: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/read?relPath=${encodeURIComponent(item.relPath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (isEdit) {
          setEditingFile({ name: item.name, relPath: item.relPath, content: data.content });
        } else {
          setViewingFile({ name: item.name, content: data.content });
        }
      } else {
        triggerToast(data.error || 'Failed to read file', 'error');
      }
    } catch (err) {
      triggerToast('Error reading file', 'error');
    }
  };

  const handleFileActionRename = async () => {
    if (!selectedFileItem || !renameNewName || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: selectedFileItem.relPath, newName: renameNewName })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setShowRenameDialog(false);
        setRenameNewName('');
        setSelectedFileItem(null);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error || 'Failed to rename file', 'error');
      }
    } catch (err) {
      triggerToast('Error renaming file', 'error');
    }
  };

  const handleFileActionChmod = async () => {
    if (!selectedFileItem || !chmodValue || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/chmod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: selectedFileItem.relPath, mode: chmodValue })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setShowChmodDialog(false);
        setSelectedFileItem(null);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error || 'Failed to change permissions', 'error');
      }
    } catch (err) {
      triggerToast('Error changing permissions', 'error');
    }
  };

  const handleFileActionCopy = async () => {
    if (!selectedFileItem || !copyDest || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: selectedFileItem.relPath, destRelPath: copyDest })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setShowCopyDialog(false);
        setCopyDest('');
        setSelectedFileItem(null);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error || 'Failed to copy', 'error');
      }
    } catch (err) {
      triggerToast('Error copying file', 'error');
    }
  };

  const handleFileActionMove = async () => {
    if (!selectedFileItem || !moveDest || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/files/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: selectedFileItem.relPath, destRelPath: moveDest })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setShowMoveDialog(false);
        setMoveDest('');
        setSelectedFileItem(null);
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error || 'Failed to move', 'error');
      }
    } catch (err) {
      triggerToast('Error moving file', 'error');
    }
  };

  const handleFileActionDownload = (item: FileItem) => {
    if (!token) return;
    window.open(`${API_BASE}/cpanel/files/download?relPath=${encodeURIComponent(item.relPath)}&token=${encodeURIComponent(token)}`, '_blank');
  };

  const handleFileActionUpload = async () => {
    if (!uploadFileName || !token) return;
    try {
      const targetRelPath = currentPath ? `${currentPath}/${uploadFileName}` : uploadFileName;
      const res = await fetch(`${API_BASE}/cpanel/files/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relPath: targetRelPath, content: uploadFileContent })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message || 'File uploaded successfully');
        setShowUploadDialog(false);
        setUploadFileName('');
        setUploadFileContent('');
        await fetchFiles(currentPath);
      } else {
        triggerToast(data.error || 'Failed to upload file', 'error');
      }
    } catch (err) {
      triggerToast('Error uploading file', 'error');
    }
  };


  // SSL Issuance live execution
  const handleIssueSSL = async (domain: string) => {
    if (!token) return;
    triggerToast(`Initiating Let's Encrypt challenge for ${domain}...`);
    try {
      const res = await fetch(`${API_BASE}/cpanel/ssl/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ domain })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`SSL Certificate Issued successfully for ${domain}!`);
        await fetchAllData(token);
      } else {
        triggerToast(data.error || 'Failed to issue SSL cert', 'error');
      }
    } catch (err) {
      triggerToast('Network error during SSL issuance', 'error');
    }
  };

  // Terminal terminal executor live
  // DNS Zone Editor handlers
  const fetchDnsRecords = async (domainName: string) => {
    if (!token || !domainName) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/dns/${domainName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setDnsRecords(await res.json());
      else setDnsRecords([]);
    } catch { setDnsRecords([]); }
  };

  const handleAddDnsRecord = async () => {
    if (!dnsNewName || !dnsNewContent || !token || !dnsSelectedDomain) {
      triggerToast('Name and content are required', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/cpanel/dns/${dnsSelectedDomain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: dnsNewName, type: dnsNewType, content: dnsNewContent, ttl: dnsNewTtl, priority: dnsNewPriority })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`DNS record added`);
        setDnsNewName(''); setDnsNewContent('');
        await fetchDnsRecords(dnsSelectedDomain);
      } else { triggerToast(data.error || 'Failed to add DNS record', 'error'); }
    } catch { triggerToast('Error adding DNS record', 'error'); }
  };

  const handleDeleteDnsRecord = async (recordId: string) => {
    if (!confirm('Delete this DNS record?') || !token || !dnsSelectedDomain) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/dns/${dnsSelectedDomain}/${recordId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { triggerToast('DNS record deleted'); await fetchDnsRecords(dnsSelectedDomain); }
      else triggerToast('Failed to delete record', 'error');
    } catch { triggerToast('Error deleting DNS record', 'error'); }
  };

  // Cron Jobs handlers
  const handleCreateCron = async () => {
    if (!cronCommand || !token) { triggerToast('Command is required', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/cpanel/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ minute: cronMinute, hour: cronHour, day: cronDay, month: cronMonth, weekday: cronWeekday, command: cronCommand })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('Cron job created');
        setCronCommand(''); setCronMinute('*'); setCronHour('*'); setCronDay('*'); setCronMonth('*'); setCronWeekday('*');
        await fetchAllData(token);
      } else { triggerToast(data.error || 'Failed to create cron job', 'error'); }
    } catch { triggerToast('Error creating cron job', 'error'); }
  };

  const handleDeleteCron = async (id: string) => {
    if (!confirm('Delete this cron job?') || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/cron/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { triggerToast('Cron job deleted'); await fetchAllData(token); }
      else triggerToast('Failed to delete cron job', 'error');
    } catch { triggerToast('Error deleting cron job', 'error'); }
  };

  // Backup handlers
  const handleCreateBackup = async () => {
    if (!token) return;
    triggerToast('Starting full backup...');
    try {
      const res = await fetch(`${API_BASE}/cpanel/backups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok) { triggerToast(`Backup started: ${data.backupName}`); await fetchAllData(token); }
      else triggerToast(data.error || 'Failed to start backup', 'error');
    } catch { triggerToast('Error starting backup', 'error'); }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('Delete this backup?') || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/backups/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { triggerToast('Backup deleted'); await fetchAllData(token); }
      else triggerToast('Failed to delete backup', 'error');
    } catch { triggerToast('Error deleting backup', 'error'); }
  };

  // MySQL Users handlers
  const handleCreateMysqlUser = async () => {
    if (!newMysqlUser || !newMysqlUserPass || !token) { triggerToast('Username and password required', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/cpanel/mysql/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newMysqlUser, password: newMysqlUserPass })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`MySQL user created: ${data.username}`);
        setNewMysqlUser(''); setNewMysqlUserPass('');
        await fetchAllData(token);
      } else { triggerToast(data.error || 'Failed to create user', 'error'); }
    } catch { triggerToast('Error creating MySQL user', 'error'); }
  };

  const handleAssignDbUser = async () => {
    if (!assignDb || !assignUser || !token) { triggerToast('Select database and user', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/cpanel/mysql/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dbName: assignDb, dbUser: assignUser, privileges: ['ALL'] })
      });
      const data = await res.json();
      if (res.ok) { triggerToast(`Privileges granted to ${assignUser} on ${assignDb}`); }
      else triggerToast(data.error || 'Failed to assign privileges', 'error');
    } catch { triggerToast('Error assigning privileges', 'error'); }
  };

  const handleDeleteMysqlDb = async (dbName: string) => {
    if (!confirm(`Drop database ${dbName}? This cannot be undone.`) || !token) return;
    try {
      const res = await fetch(`${API_BASE}/cpanel/mysql/databases/${encodeURIComponent(dbName)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { triggerToast(`Database ${dbName} dropped`); await fetchAllData(token); }
      else triggerToast('Failed to drop database', 'error');
    } catch { triggerToast('Error dropping database', 'error'); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f5f7fa', fontFamily: 'sans-serif' }}>
        <svg style={{ animation: 'spin 1s linear infinite', height: '40px', width: '40px', color: '#ff6c2c', marginBottom: '16px' }} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <div style={{ fontSize: '15px', color: '#1f2d3d', fontWeight: 'bold' }}>Loading Live host environment...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1f2d3d 0%, #2d4059 100%)' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', borderRadius: '12px', padding: '40px 44px', minWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ff6c2c', letterSpacing: '-1px' }}>cPanel</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Sign in to manage your hosting account</div>
          </div>
          {loginError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 14px', color: '#dc2626', fontSize: '13px' }}>
              {loginError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Username or Email</label>
            <input
              type="text" autoFocus autoComplete="username"
              value={loginUser} onChange={e => setLoginUser(e.target.value)}
              placeholder="e.g. zanaen or zanaenullah75@gmail.com"
              style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Password</label>
            <input
              type="password" autoComplete="current-password"
              value={loginPass} onChange={e => setLoginPass(e.target.value)}
              placeholder="••••••••"
              style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <button
            type="submit" disabled={loggingIn}
            style={{ padding: '11px', borderRadius: '6px', border: 'none', background: '#ff6c2c', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: loggingIn ? 'not-allowed' : 'pointer', opacity: loggingIn ? 0.7 : 1 }}
          >
            {loggingIn ? 'Signing in…' : 'Log In'}
          </button>
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
            WHM admin? <a href="http://localhost:2087" style={{ color: '#ff6c2c', textDecoration: 'none' }}>Go to WHM →</a>
          </div>
        </form>
      </div>
    );
  }


  // ── Sidebar helpers ─────────────────────────────────────────────────────────
  const NavItem = ({ label, page, indent = false }: { label: string; page: string; indent?: boolean }) => {
    if (searchQuery && !label.toLowerCase().includes(searchQuery.toLowerCase())) {
      return null;
    }
    return (
      <button
        onClick={() => setCurrentPage(page)}
        style={{
          display: 'flex', alignItems: 'center', width: '100%',
          padding: indent ? '7px 16px 7px 28px' : '7px 16px',
          border: 'none', textAlign: 'left', background: currentPage === page ? 'rgba(249,115,22,0.18)' : 'none',
          color: currentPage === page ? '#ffffff' : 'rgba(255,255,255,0.72)',
          borderLeft: currentPage === page ? '3px solid #f97316' : '3px solid transparent',
          fontSize: 13, cursor: 'pointer', fontWeight: currentPage === page ? 600 : 400, lineHeight: 1.4,
        }}
      >{label}</button>
    );
  };

  const SectionHeader = ({ id, label }: { id: string; label: string }) => (
    <button onClick={() => toggleSidebarSection(id)} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '8px 16px 4px', border: 'none', background: 'none',
      color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', marginTop: 6,
    }}>
      <span>{label}</span>
      <span style={{ fontSize: 8 }}>{sidebarSections[id] ? '▲' : '▼'}</span>
    </button>
  );

  // ── Shared page card wrapper ─────────────────────────────────────────────────
  const PageCard = ({ title, children, headerRight }: { title: string; children: React.ReactNode; headerRight?: React.ReactNode }) => (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>{title}</h2>
        {headerRight}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );

  const p = accountPlan?.plan;
  const u = accountPlan?.usage;
  const fmtLimit = (v: number | null | undefined) => (v === null || v === undefined) ? '∞' : String(v);
  const diskUsedMB = Math.round(diskUsage.totalBytes / (1024 * 1024));
  const diskLimitMB = p?.disk_mb || 0;
  const diskPct = diskLimitMB > 0 ? Math.min(100, Math.round((diskUsedMB / diskLimitMB) * 100)) : 0;
  const addonUsed = u?.addon_domains ?? Math.max(0, domains.length - 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f4f8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <header style={{ background: '#1a2b4c', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 52, flexShrink: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <svg style={{ height: 28, width: 110 }} viewBox="0 0 160 40" fill="none">
            <path d="M12.4 12C9.4 12 7 14.4 7 17.4V22.6C7 25.6 9.4 28 12.4 28H19.6C22.6 28 25 25.6 25 22.6V17.4C25 14.4 22.6 12 19.6 12H12.4Z" fill="#ff6c2c" />
            <path d="M16 16C13.8 16 12 17.8 12 20C12 22.2 13.8 24 16 24C18.2 24 20 22.2 20 20C20 17.8 18.2 16 16 16Z" fill="#fff" />
            <text x="34" y="27" fill="#ffffff" fontSize="22" fontWeight="800" fontFamily="-apple-system,sans-serif">cPanel</text>
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>|</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{primaryDomainName}</span>
        </div>
        <div style={{ flex: 1, position: 'relative', maxWidth: 400 }}>
          <input
            type="text" placeholder="Search pages..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{currentUser}</span>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Logout
          </button>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside style={{ width: 220, background: '#1a2b4c', overflowY: 'auto', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <nav style={{ paddingBottom: 24 }}>
            {/* Home */}
            <div style={{ padding: '12px 16px 8px' }}>
              <button onClick={() => setCurrentPage('home')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', borderRadius: 6, background: currentPage === 'home' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)', color: currentPage === 'home' ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: currentPage === 'home' ? 700 : 500, cursor: 'pointer' }}>
                <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="currentColor"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>
                Home
              </button>
            </div>

            {/* Email */}
            <SectionHeader id="email" label="Email" />
            {sidebarSections.email && (<>
              <NavItem label="Email Accounts" page="email" indent />
              <NavItem label="Webmail" page="webmail" indent />
              <NavItem label="Forwarders" page="forwarder" indent />
              <NavItem label="Email Routing" page="email_routing" indent />
              <NavItem label="Autoresponders" page="autoresponders" indent />
              <NavItem label="Default Address" page="default_address" indent />
              <NavItem label="Mailing Lists" page="mailing_lists" indent />
              <NavItem label="Track Delivery" page="track_delivery" indent />
              <NavItem label="Global Filters" page="global_email_filters" indent />
              <NavItem label="Email Filters" page="email_filters" indent />
              <NavItem label="Deliverability" page="email_deliverability" indent />
              <NavItem label="Address Importer" page="address_importer" indent />
              <NavItem label="Spam Filters" page="spam_filters" indent />
              <NavItem label="Encryption" page="encryption" indent />
              <NavItem label="BoxTrapper" page="boxtrapper" indent />
              <NavItem label="Calendars Config" page="calendars_config" indent />
              <NavItem label="Calendars Sharing" page="calendars_sharing" indent />
              <NavItem label="Calendars Mgmt" page="calendars_management" indent />
              <NavItem label="Email Disk Usage" page="email_disk_usage" indent />
            </>)}

            {/* Files */}
            <SectionHeader id="files" label="Files" />
            {sidebarSections.files && (<>
              <NavItem label="File Manager" page="filemanager" indent />
              <NavItem label="WordPress Toolkit" page="wordpress" indent />
              <NavItem label="Images" page="images" indent />
              <NavItem label="Disk Usage" page="disk_usage" indent />
              <NavItem label="FTP Accounts" page="ftp" indent />
              <NavItem label="Backups" page="backups" indent />
            </>)}

            {/* Databases */}
            <SectionHeader id="db" label="Databases" />
            {sidebarSections.db && (<>
              <NavItem label="MySQL Databases" page="db" indent />
              <NavItem label="phpMyAdmin" page="phpmyadmin" indent />
            </>)}

            {/* Domains */}
            <SectionHeader id="domains" label="Domains" />
            {sidebarSections.domains && (<>
              <NavItem label="Addon Domains" page="domain" indent />
              <NavItem label="Redirects" page="redirect" indent />
              <NavItem label="DNS Zone Editor" page="dns" indent />
            </>)}

            {/* Metrics */}
            <SectionHeader id="metrics" label="Metrics" />
            {sidebarSections.metrics && (<>
              <NavItem label="Visitors" page="visitors" indent />
              <NavItem label="Bandwidth" page="bandwidth" indent />
            </>)}

            {/* Security */}
            <SectionHeader id="security" label="Security" />
            {sidebarSections.security && (<>
              <NavItem label="SSL/TLS" page="ssl" indent />
              <NavItem label="SSH Terminal" page="terminal" indent />
            </>)}

            {/* Advanced */}
            <SectionHeader id="advanced" label="Advanced" />
            {sidebarSections.advanced && (<>
              <NavItem label="Cron Jobs" page="cron" indent />
            </>)}
          </nav>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#f0f4f8' }}>

          {/* ── HOME DASHBOARD ─────────────────────────────────────────────── */}
          {currentPage === 'home' && (
            <div style={{ padding: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2b4c', margin: '0 0 20px' }}>Dashboard</h1>

              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                {[
                  { label: 'Email Accounts', used: u?.email_accounts ?? emails.length, limit: p?.max_email_accounts, color: '#f97316' },
                  { label: 'MySQL Databases', used: u?.databases ?? databases.length, limit: p?.max_databases, color: '#3b82f6' },
                  { label: 'FTP Accounts', used: u?.ftp_accounts ?? ftpAccounts.length, limit: p?.max_ftp_accounts, color: '#8b5cf6' },
                  { label: 'Addon Domains', used: addonUsed, limit: p?.max_addon_domains, color: '#10b981' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderTop: `3px solid ${card.color}` }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{card.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1a2b4c' }}>{card.used}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>of {fmtLimit(card.limit ?? null)}</div>
                  </div>
                ))}
              </div>

              {/* Disk usage bar */}
              {diskLimitMB > 0 && (
                <div style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2b4c' }}>Disk Usage</span>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{diskUsedMB >= 1024 ? `${(diskUsedMB/1024).toFixed(2)} GB` : `${diskUsedMB} MB`} / {diskLimitMB >= 1024 ? `${(diskLimitMB/1024).toFixed(2)} GB` : `${diskLimitMB} MB`}</span>
                  </div>
                  <div style={{ background: '#e5e7eb', borderRadius: 4, height: 10 }}>
                    <div style={{ background: diskPct > 80 ? '#f97316' : '#22c55e', width: `${diskPct}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{diskPct}% used</div>
                </div>
              )}

              {/* Two-column: Quick links + Server info */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                {/* Quick links */}
                <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '16px 20px' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1a2b4c' }}>Quick Links</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Email Accounts', page: 'email', icon: '📧' },
                      { label: 'File Manager', page: 'filemanager', icon: '📁' },
                      { label: 'Databases', page: 'db', icon: '🗄️' },
                      { label: 'WordPress Toolkit', page: 'wordpress', icon: '📝' },
                      { label: 'DNS Editor', page: 'dns', icon: '🌐' },
                      { label: 'FTP Accounts', page: 'ftp', icon: '📤' },
                      { label: 'SSL/TLS', page: 'ssl', icon: '🔒' },
                      { label: 'Cron Jobs', page: 'cron', icon: '⏰' },
                      { label: 'Backups', page: 'backups', icon: '💾' },
                    ].map(item => (
                      <button key={item.page} onClick={() => setCurrentPage(item.page)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 500, transition: 'all 0.15s' }}
                        onMouseOver={e => (e.currentTarget.style.background = '#fff7ed', e.currentTarget.style.borderColor = '#f97316')}
                        onMouseOut={e => (e.currentTarget.style.background = '#fafafa', e.currentTarget.style.borderColor = '#e5e7eb')}>
                        <span style={{ fontSize: 22 }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Server info */}
                <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '16px 20px' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1a2b4c' }}>General Information</h3>
                  {[
                    { label: 'Current User', value: currentUser },
                    { label: 'Primary Domain', value: primaryDomainName },
                    { label: 'Shared IP', value: serverIp },
                    { label: 'Home Dir', value: `/home/${currentUser}` },
                    { label: 'Last Login IP', value: lastLoginIp },
                    { label: 'Plan', value: p?.name || 'N/A' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>{row.label}</span>
                      <span style={{ color: '#1a2b4c', fontWeight: 500 }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── EMAIL ACCOUNTS ─────────────────────────────────────────────── */}
          {currentPage === 'email' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Email Accounts</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Email Accounts</h2>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{emails.length} account{emails.length !== 1 ? 's' : ''}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Email Address', 'Quota', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emails.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: '24px 20px', color: '#9ca3af', textAlign: 'center' }}>No email accounts yet. Create one below.</td></tr>
                    ) : emails.map((e: any) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 20px', fontWeight: 500, color: '#1f2d3d' }}>{e.local_part}@{e.domain}</td>
                        <td style={{ padding: '12px 20px', color: '#6b7280' }}>{e.quota_mb > 0 ? `${e.quota_mb} MB` : 'Unlimited'}</td>
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <a href={`http://localhost:2096/?_user=${encodeURIComponent(e.local_part + '@' + e.domain)}`} target="_blank" rel="noreferrer" style={{ background: '#1a2b4c', color: '#fff', padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', textDecoration: 'none' }}>Webmail ↗</a>
                            <button onClick={async () => {
                              if (!window.confirm(`Delete ${e.local_part}@${e.domain}?`)) return;
                              const r = await fetch(`${API_BASE}/cpanel/mail/${encodeURIComponent(e.local_part + '@' + e.domain)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                              if (r.ok) { triggerToast('Email account deleted'); fetchAllData(token!); }
                              else triggerToast('Failed to delete', 'error');
                            }} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '18px 20px', background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 700, color: '#1a2b4c', fontSize: 14, marginBottom: 12 }}>Create Email Account</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '2 1 200px' }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Username</label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input type="text" placeholder="e.g. info" value={newUser} onChange={e => setNewUser(e.target.value)} className="text-input" style={{ borderRadius: '4px 0 0 4px', borderRight: 'none' }} />
                        <select className="theme-select" value={selectedMailDomain} onChange={e => setSelectedMailDomain(e.target.value)} style={{ borderRadius: '0 4px 4px 0', padding: '7px 8px' }}>
                          {domains.map(d => <option key={d.domain} value={d.domain}>@{d.domain}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Password</label>
                      <input type="password" placeholder="••••••••" value={newPass} onChange={e => setNewPass(e.target.value)} className="text-input" />
                    </div>
                    <button className="btn-primary" onClick={handleCreateEmail} style={{ flexShrink: 0, height: 36 }}>+ Create Account</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── WEBMAIL ────────────────────────────────────────────────────── */}
          {currentPage === 'webmail' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Webmail</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ background: '#1a2b4c', padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 16, height: 16 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Webmail</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                    Powered by RoundCube — same webmail client used by real cPanel (opens in a new tab, just like cPanel does)
                  </div>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {emails.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>No email accounts</div>
                        <div style={{ fontSize: 13 }}>Create an email account first from the Email Accounts page.</div>
                      </div>
                    ) : emails.map((em: any) => {
                      const address = `${em.local_part}@${em.domain}`;
                      const webmailUrl = `http://localhost:2096/?_user=${encodeURIComponent(address)}`;
                      return (
                        <div key={em.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1a2b4c', fontSize: 14 }}>{address}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              Quota: {em.quota_mb > 0 ? `${em.quota_mb} MB` : 'Unlimited'}
                            </div>
                          </div>
                          <a
                            href={webmailUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#1a2b4c', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            Open Webmail ↗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  {emails.length > 0 && (
                    <div style={{ marginTop: 20, padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, fontSize: 12, color: '#0369a1' }}>
                      ℹ️ RoundCube opens at <strong>localhost:2096</strong>. Log in with your email address and the password you set when creating the account.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── FORWARDERS ─────────────────────────────────────────────────── */}
          {currentPage === 'forwarder' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Forwarders</nav>
              <PageCard title="Email Forwarders">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Source</th><th style={{ padding: '8px 12px' }}>Forwards To</th><th style={{ padding: '8px 12px', width: 80 }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {forwarders.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No forwarders configured.</td></tr>
                    ) : forwarders.map(f => (
                      <tr key={f.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>✉️ {f.source}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>➡️ {f.destination}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11, color: '#f56c6c' }} onClick={async () => {
                            if (!confirm('Delete this forwarder?') || !token) return;
                            const res = await fetch(`${API_BASE}/cpanel/mail/forwarders/${f.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                            if (res.ok) { triggerToast('Forwarder deleted'); await fetchAllData(token); }
                            else triggerToast('Error deleting forwarder', 'error');
                          }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, paddingTop: 12, borderTop: '1px solid #e4e7ed' }}>Add New Forwarder</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <label className="form-label">Address to Forward</label>
                    <div className="form-input-container">
                      <input type="text" placeholder="e.g. contact" value={fwdSource} onChange={e => setFwdSource(e.target.value)} className="text-input" />
                      <select className="theme-select" value={selectedMailDomain} onChange={e => setSelectedMailDomain(e.target.value)} style={{ padding: '6px' }}>
                        {domains.map(d => <option key={d.domain} value={d.domain}>@{d.domain}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Destination</label>
                    <input type="text" placeholder="e.g. backup@gmail.com" value={fwdDest} onChange={e => setFwdDest(e.target.value)} className="text-input" />
                  </div>
                  <button className="btn-primary" onClick={handleCreateForwarder} style={{ height: 36 }}>Add Forwarder</button>
                </div>
              </PageCard>
            </div>
          )}

          {/* ── EMAIL ROUTING ──────────────────────────────────────────────── */}
          {currentPage === 'email_routing' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Email Routing</nav>
              <PageCard title="Email Routing Manager">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold' }}>Select Domain</label>
                  <select className="theme-select" value={selectedRoutingDomain} onChange={e => { const dom = e.target.value; setSelectedRoutingDomain(dom); const existing = emailRoutings.find(r => r.domain === dom); setSelectedRoutingType(existing?.routing_type || 'local'); }} style={{ width: '100%', padding: '8px' }}>
                    {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label" style={{ fontWeight: 'bold', marginBottom: 8, display: 'block' }}>Routing Configuration</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { val: 'local', title: 'Local Mail Exchanger', desc: 'This server will receive mail for this domain. Mail will be delivered to local mailboxes.' },
                      { val: 'backup', title: 'Backup Mail Exchanger', desc: 'This server will act as a backup mail exchanger. Mail will be held until the primary is available.' },
                      { val: 'remote', title: 'Remote Mail Exchanger', desc: 'This server will not receive mail for this domain. Mail will be delivered to remote MX records.' },
                    ].map(opt => (
                      <label key={opt.val} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="routing_type" value={opt.val} checked={selectedRoutingType === opt.val} onChange={e => setSelectedRoutingType(e.target.value)} style={{ marginTop: 3 }} />
                        <div><strong>{opt.title}</strong><span style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>{opt.desc}</span></div>
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleUpdateEmailRouting}>Save Routing Setting</button>
              </PageCard>
            </div>
          )}

          {/* ── AUTORESPONDERS ─────────────────────────────────────────────── */}
          {currentPage === 'autoresponders' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Autoresponders</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Autoresponders</h2>
                  {!editingAutoresponder && <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setEditingAutoresponder({ isNew: true })}>+ Add Autoresponder</button>}
                </div>
                <div style={{ padding: 20 }}>
                  {!editingAutoresponder ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Email</th><th style={{ padding: '8px 12px' }}>Subject</th><th style={{ padding: '8px 12px' }}>Interval</th><th style={{ padding: '8px 12px', width: 130 }}>Actions</th>
                      </tr></thead>
                      <tbody>
                        {autoresponders.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No autoresponders configured.</td></tr>
                        ) : autoresponders.map(a => (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>🤖 {a.email}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{a.subject}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{a.interval_hours}h</td>
                            <td style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                              <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { const [local, domain] = a.email.split('@'); setAutoEmailLocal(local); setSelectedMailDomain(domain); setAutoFromName(a.from_name); setAutoSubject(a.subject); setAutoBody(a.body); setAutoInterval(a.interval_hours); setEditingAutoresponder(a); }}>Edit</button>
                              <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11, color: '#f56c6c' }} onClick={() => handleDeleteAutoresponder(a.id)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ maxWidth: 560 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editingAutoresponder.isNew ? 'Create New Autoresponder' : `Edit: ${editingAutoresponder.email}`}</h3>
                      <div className="form-group">
                        <label className="form-label">Email Address</label>
                        {editingAutoresponder.isNew ? (
                          <div className="form-input-container">
                            <input type="text" placeholder="support" value={autoEmailLocal} onChange={e => setAutoEmailLocal(e.target.value)} className="text-input" />
                            <select className="theme-select" value={selectedMailDomain} onChange={e => setSelectedMailDomain(e.target.value)} style={{ padding: '6px' }}>
                              {domains.map(d => <option key={d.domain} value={d.domain}>@{d.domain}</option>)}
                            </select>
                          </div>
                        ) : (
                          <input type="text" value={editingAutoresponder.email} readOnly className="text-input" style={{ background: '#f5f7fa', color: '#6b7280' }} />
                        )}
                      </div>
                      {[
                        { label: 'From Name', val: autoFromName, set: setAutoFromName, ph: 'e.g. Customer Support' },
                        { label: 'Subject', val: autoSubject, set: setAutoSubject, ph: 'e.g. Thank you for your email' },
                      ].map(f => (
                        <div key={f.label} className="form-group">
                          <label className="form-label">{f.label}</label>
                          <input type="text" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} className="text-input" />
                        </div>
                      ))}
                      <div className="form-group">
                        <label className="form-label">Body</label>
                        <textarea value={autoBody} onChange={e => setAutoBody(e.target.value)} className="text-input" style={{ height: 100, padding: 8 }} placeholder="Enter automated response body..." />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Interval (Hours)</label>
                        <input type="number" min="1" value={autoInterval} onChange={e => setAutoInterval(Number(e.target.value) || 1)} className="text-input" />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                        <button className="btn-secondary" onClick={() => { setEditingAutoresponder(null); setAutoEmailLocal(''); setAutoFromName(''); setAutoSubject(''); setAutoBody(''); setAutoInterval(1); }}>Cancel</button>
                        <button className="btn-primary" onClick={handleCreateOrUpdateAutoresponder}>Save Config</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DEFAULT ADDRESS ────────────────────────────────────────────── */}
          {currentPage === 'default_address' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Default Address</nav>
              <DefaultAddressModal token={token!} domains={domains} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── MAILING LISTS ──────────────────────────────────────────────── */}
          {currentPage === 'mailing_lists' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Mailing Lists</nav>
              <MailingListsModal token={token!} domains={domains} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── TRACK DELIVERY ─────────────────────────────────────────────── */}
          {currentPage === 'track_delivery' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Track Delivery</nav>
              <TrackDeliveryModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── GLOBAL EMAIL FILTERS ───────────────────────────────────────── */}
          {currentPage === 'global_email_filters' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Global Filters</nav>
              <EmailFiltersModal token={token!} scope="global" title="Global Email Filters" onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── EMAIL FILTERS ──────────────────────────────────────────────── */}
          {currentPage === 'email_filters' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Email Filters</nav>
              <EmailFiltersModal token={token!} scope="account" title="Email Account Filters" onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── EMAIL DELIVERABILITY ───────────────────────────────────────── */}
          {currentPage === 'email_deliverability' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Deliverability</nav>
              <EmailDeliverabilityModal token={token!} domains={domains} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── ADDRESS IMPORTER ───────────────────────────────────────────── */}
          {currentPage === 'address_importer' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Address Importer</nav>
              <AddressImporterModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── SPAM FILTERS ───────────────────────────────────────────────── */}
          {currentPage === 'spam_filters' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Spam Filters</nav>
              <SpamFiltersModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── ENCRYPTION ─────────────────────────────────────────────────── */}
          {currentPage === 'encryption' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Encryption</nav>
              <EncryptionModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── BOXTRAPPER ─────────────────────────────────────────────────── */}
          {currentPage === 'boxtrapper' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › BoxTrapper</nav>
              <BoxTrapperModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── CALENDARS CONFIG ───────────────────────────────────────────── */}
          {currentPage === 'calendars_config' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Calendars Config</nav>
              <CalendarsConfigModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── CALENDARS SHARING ──────────────────────────────────────────── */}
          {currentPage === 'calendars_sharing' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Calendars Sharing</nav>
              <CalendarsSharingModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── CALENDARS MANAGEMENT ───────────────────────────────────────── */}
          {currentPage === 'calendars_management' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Calendars Management</nav>
              <CalendarsManagementModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── EMAIL DISK USAGE ───────────────────────────────────────────── */}
          {currentPage === 'email_disk_usage' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Email › Email Disk Usage</nav>
              <EmailDiskUsageModal token={token!} onClose={() => setCurrentPage('home')} triggerToast={triggerToast} pageMode />
            </div>
          )}

          {/* ── FILE MANAGER ───────────────────────────────────────────────── */}
          {currentPage === 'filemanager' && (
            <div style={{ padding: 24, minHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8' }}>Home › Files › File Manager</nav>

              {/* cPanel Action Toolbar */}
              <div style={{
                background: '#f8f9fa',
                border: '1px solid #dcdfe6',
                borderRadius: '6px',
                padding: '8px 12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} onClick={() => setShowNewFileDialog(true)}>
                  📄 + File
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} onClick={() => setShowNewFolderDialog(true)}>
                  📁 + Folder
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem} 
                  onClick={() => { if (selectedFileItem) { setCopyDest(selectedFileItem.relPath); setShowCopyDialog(true); } }}>
                  📋 Copy
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem} 
                  onClick={() => { if (selectedFileItem) { setMoveDest(selectedFileItem.relPath); setShowMoveDialog(true); } }}>
                  🚚 Move
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} onClick={() => setShowUploadDialog(true)}>
                  📤 Upload
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem || selectedFileItem.isDirectory} 
                  onClick={() => selectedFileItem && handleFileActionDownload(selectedFileItem)}>
                  📥 Download
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12, color: '#ef4444' }} 
                  disabled={!selectedFileItem} 
                  onClick={() => selectedFileItem && handleFileActionDelete(selectedFileItem.relPath)}>
                  🗑️ Delete
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem} 
                  onClick={() => { if (selectedFileItem) { setRenameNewName(selectedFileItem.name); setShowRenameDialog(true); } }}>
                  ✏️ Rename
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem || selectedFileItem.isDirectory} 
                  onClick={() => selectedFileItem && handleFileActionRead(selectedFileItem, true)}>
                  📝 Edit
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem || selectedFileItem.isDirectory} 
                  onClick={() => selectedFileItem && handleFileActionRead(selectedFileItem, false)}>
                  👁️ View
                </button>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }} 
                  disabled={!selectedFileItem} 
                  onClick={() => { if (selectedFileItem) { setChmodValue(selectedFileItem.permissions || '0644'); setShowChmodDialog(true); } }}>
                  🔑 Permissions
                </button>
              </div>

              {/* cPanel Location Bar & Search */}
              <div style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} 
                    onClick={() => {
                      const parts = currentPath.split('/');
                      parts.pop();
                      fetchFiles(parts.join('/'));
                    }} 
                    disabled={!currentPath || currentPath === 'public_html'}>
                    ⬅️ Up One Level
                  </button>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>Current Path:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#111827', background: '#f3f4f6', padding: '4px 8px', borderRadius: 4, fontSize: 13 }}>
                    /home/{currentUser}/{currentPath || '.'}
                  </strong>
                </div>
              </div>

              {/* Editor Workspace Panel (If open) */}
              {editingFile && (
                <div style={{ background: '#fff', border: '1px solid #dcdfe6', borderRadius: 6, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>✏️ Editing: <code style={{ color: '#2563eb' }}>{editingFile.relPath}</code></h3>
                    <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setEditingFile(null)}>Close Editor</button>
                  </div>
                  <textarea 
                    style={{
                      width: '100%',
                      height: 450,
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: 13,
                      padding: 12,
                      border: '1px solid #dcdfe6',
                      borderRadius: 4,
                      outline: 'none',
                      boxSizing: 'border-box',
                      lineHeight: '1.5',
                      background: '#fafafa'
                    }} 
                    value={editingFile.content} 
                    onChange={e => setEditingFile({ ...editingFile, content: e.target.value })} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button className="btn-secondary" onClick={() => setEditingFile(null)}>Cancel</button>
                    <button className="btn-primary" onClick={handleFileActionSave}>Save Changes</button>
                  </div>
                </div>
              )}

              {/* View Only Panel (If open) */}
              {viewingFile && (
                <div style={{ background: '#fff', border: '1px solid #dcdfe6', borderRadius: 6, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>👁️ Viewing: <code style={{ color: '#059669' }}>{viewingFile.name}</code></h3>
                    <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setViewingFile(null)}>Close View</button>
                  </div>
                  <pre 
                    style={{
                      width: '100%',
                      height: 400,
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: 13,
                      padding: 12,
                      border: '1px solid #dcdfe6',
                      borderRadius: 4,
                      overflow: 'auto',
                      boxSizing: 'border-box',
                      background: '#f9fafb',
                      margin: 0
                    }}
                  >
                    {viewingFile.content || '(File is empty)'}
                  </pre>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="btn-secondary" onClick={() => setViewingFile(null)}>Close</button>
                  </div>
                </div>
              )}

              {/* Main File Manager Workspace Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, flex: 1, minHeight: 480 }}>
                {/* Left Folder Tree Sidebar */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <h3 style={{ margin: 0, fontSize: 13, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Folders</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <div 
                      onClick={() => fetchFiles('')} 
                      style={{
                        padding: '6px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: currentPath === '' ? '#eff6ff' : 'transparent',
                        color: currentPath === '' ? '#1d4ed8' : '#374151',
                        fontWeight: currentPath === '' ? 'bold' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      🏠 Home (/home/{currentUser})
                    </div>
                    <div 
                      onClick={() => fetchFiles('public_html')} 
                      style={{
                        padding: '6px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: currentPath.startsWith('public_html') ? '#eff6ff' : 'transparent',
                        color: currentPath.startsWith('public_html') ? '#1d4ed8' : '#374151',
                        fontWeight: currentPath.startsWith('public_html') ? 'bold' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 12
                      }}
                    >
                      📁 public_html
                    </div>
                    <div 
                      onClick={() => fetchFiles('etc')} 
                      style={{
                        padding: '6px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: currentPath.startsWith('etc') ? '#eff6ff' : 'transparent',
                        color: currentPath.startsWith('etc') ? '#1d4ed8' : '#374151',
                        fontWeight: currentPath.startsWith('etc') ? 'bold' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 12
                      }}
                    >
                      📁 etc
                    </div>
                    <div 
                      onClick={() => fetchFiles('mail')} 
                      style={{
                        padding: '6px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: currentPath.startsWith('mail') ? '#eff6ff' : 'transparent',
                        color: currentPath.startsWith('mail') ? '#1d4ed8' : '#374151',
                        fontWeight: currentPath.startsWith('mail') ? 'bold' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 12
                      }}
                    >
                      📁 mail
                    </div>
                    <div 
                      onClick={() => fetchFiles('tmp')} 
                      style={{
                        padding: '6px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: currentPath.startsWith('tmp') ? '#eff6ff' : 'transparent',
                        color: currentPath.startsWith('tmp') ? '#1d4ed8' : '#374151',
                        fontWeight: currentPath.startsWith('tmp') ? 'bold' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 12
                      }}
                    >
                      📁 tmp
                    </div>
                  </div>
                </div>

                {/* Right Folder / File Listing */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '10px 12px', width: '40%' }}>Name</th>
                          <th style={{ padding: '10px 12px' }}>Size</th>
                          <th style={{ padding: '10px 12px' }}>Type</th>
                          <th style={{ padding: '10px 12px' }}>Last Modified</th>
                          <th style={{ padding: '10px 12px' }}>Permissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filesList.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                              Directory is empty
                            </td>
                          </tr>
                        ) : (
                          filesList.map(item => {
                            const isSelected = selectedFileItem?.name === item.name;
                            return (
                              <tr 
                                key={item.name}
                                onClick={() => setSelectedFileItem(item)}
                                onDoubleClick={() => {
                                  if (item.isDirectory) {
                                    fetchFiles(item.relPath);
                                    setSelectedFileItem(null);
                                  } else {
                                    handleFileActionRead(item, false);
                                  }
                                }}
                                style={{
                                  borderBottom: '1px solid #f3f4f6',
                                  cursor: 'pointer',
                                  background: isSelected ? '#eff6ff' : 'transparent',
                                  userSelect: 'none'
                                }}
                                className="filemanager-row"
                              >
                                <td style={{ padding: '10px 12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {item.isDirectory ? '📁' : '📄'} {item.name}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                                  {item.isDirectory ? '—' : `${(item.size / 1024).toFixed(2)} KB`}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                                  {item.isDirectory ? 'Folder' : 'File'}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                                  {new Date(item.updatedAt).toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#4b5563', fontFamily: 'monospace' }}>
                                  {item.permissions || '0644'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Dialog Modals */}
              {showNewFileDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Create New File</h3>
                    <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4 }}>New File Name:</label>
                    <input type="text" className="text-input" placeholder="e.g. index.html" value={newFileName} onChange={e => setNewFileName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowNewFileDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={() => handleFileActionCreate(newFileName, false)}>Create New File</button>
                    </div>
                  </div>
                </div>
              )}

              {showNewFolderDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Create New Folder</h3>
                    <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4 }}>New Folder Name:</label>
                    <input type="text" className="text-input" placeholder="e.g. assets" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowNewFolderDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={() => handleFileActionCreate(newFolderName, true)}>Create New Folder</button>
                    </div>
                  </div>
                </div>
              )}

              {showRenameDialog && selectedFileItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Rename</h3>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>Rename <code>{selectedFileItem.name}</code> to:</p>
                    <input type="text" className="text-input" value={renameNewName} onChange={e => setRenameNewName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowRenameDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleFileActionRename}>Rename File</button>
                    </div>
                  </div>
                </div>
              )}

              {showCopyDialog && selectedFileItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Copy</h3>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>Specify the destination path for copying <code>{selectedFileItem.name}</code>:</p>
                    <input type="text" className="text-input" value={copyDest} onChange={e => setCopyDest(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowCopyDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleFileActionCopy}>Copy File</button>
                    </div>
                  </div>
                </div>
              )}

              {showMoveDialog && selectedFileItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Move</h3>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>Specify the destination path for moving <code>{selectedFileItem.name}</code>:</p>
                    <input type="text" className="text-input" value={moveDest} onChange={e => setMoveDest(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowMoveDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleFileActionMove}>Move File</button>
                    </div>
                  </div>
                </div>
              )}

              {showChmodDialog && selectedFileItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Change Permissions</h3>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>Modify permissions mode for <code>{selectedFileItem.name}</code>:</p>
                    <input type="text" className="text-input" value={chmodValue} onChange={e => setChmodValue(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowChmodDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleFileActionChmod}>Save Permissions</button>
                    </div>
                  </div>
                </div>
              )}

              {showUploadDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Upload File</h3>
                    <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4 }}>File Name:</label>
                    <input type="text" className="text-input" placeholder="e.g. style.css" value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
                    <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4 }}>File Content:</label>
                    <textarea 
                      className="text-input" 
                      placeholder="Paste your file contents here..." 
                      value={uploadFileContent} 
                      onChange={e => setUploadFileContent(e.target.value)} 
                      style={{ width: '100%', height: 180, boxSizing: 'border-box', fontFamily: 'monospace', marginBottom: 16 }} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowUploadDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleFileActionUpload}>Upload</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── IMAGES ─────────────────────────────────────────────────────── */}
          {currentPage === 'images' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Files › Images</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Images</h2>
                </div>
                <div style={{ padding: 20 }}>
                  <p style={{ color: '#6b7280', marginBottom: 14, fontSize: 12 }}>Rescale, convert, or generate thumbnails inside your <code>/home/{currentUser}/public_html</code> workspace.</p>
                  {!selectedImage ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Filename</th><th style={{ padding: '8px 12px' }}>Size</th><th style={{ padding: '8px 12px' }}>Actions</th>
                      </tr></thead>
                      <tbody>
                        {workspaceImages.length === 0 ? (
                          <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No image files found in public_html.</td></tr>
                        ) : workspaceImages.map((img: any) => (
                          <tr key={img.relPath} style={{ borderBottom: '1px solid #f0f2f5' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>🖼️ {img.name}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{(img.sizeBytes / 1024).toFixed(2)} KB</td>
                            <td style={{ padding: '8px 12px' }}><button className="btn-primary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setSelectedImage(img)}>Scale Image</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Rescaling: {selectedImage.name}</h3>
                      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label">Target Width (px)</label>
                          <input type="number" className="text-input" value={scaleWidth} onChange={e => setScaleWidth(Number(e.target.value) || 100)} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label">Target Height (px)</label>
                          <input type="number" className="text-input" value={scaleHeight} onChange={e => setScaleHeight(Number(e.target.value) || 100)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={() => setSelectedImage(null)}>Back to List</button>
                        <button className="btn-primary" onClick={handleResizeImage}>Rescale and Save Copy</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DISK USAGE ─────────────────────────────────────────────────── */}
          {currentPage === 'disk_usage' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Files › Disk Usage</nav>
              <PageCard title="Disk Space Usage">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fc', border: '1px solid #e4e7ed', padding: 14, borderRadius: 4, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Total Storage Used:</span>
                  <span style={{ color: '#f97316', fontWeight: 700, fontSize: 16 }}>{(diskUsage.totalBytes / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {diskUsage.breakdown?.map((item: any) => {
                    const pct = diskUsage.totalBytes > 0 ? (item.bytes / diskUsage.totalBytes) * 100 : 0;
                    return (
                      <div key={item.name} style={{ fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontWeight: 500 }}>
                          <span>📁 {item.name}</span>
                          <span style={{ color: '#6b7280' }}>{(item.bytes / (1024 * 1024)).toFixed(2)} MB ({pct.toFixed(1)}%)</span>
                        </div>
                        <div style={{ background: '#e4e7ed', borderRadius: 4, height: 8 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#f97316', borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PageCard>
            </div>
          )}

          {/* ── FTP ACCOUNTS ───────────────────────────────────────────────── */}
          {currentPage === 'ftp' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Files › FTP Accounts</nav>
              <PageCard title="FTP Accounts">
                <div style={{ marginBottom: 20 }}>
                  {ftpAccounts.length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>No FTP accounts yet.</p>
                  ) : ftpAccounts.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f5', fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>📤 {f}</span>
                    </div>
                  ))}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, paddingTop: 12, borderTop: '1px solid #e4e7ed' }}>Add FTP Account</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <label className="form-label">FTP Login</label>
                    <div className="form-input-container">
                      <input type="text" placeholder="e.g. deploy" value={newFtp} onChange={e => setNewFtp(e.target.value)} className="text-input" />
                      <select className="theme-select" value={selectedMailDomain} onChange={e => setSelectedMailDomain(e.target.value)} style={{ padding: '6px' }}>
                        {domains.map(d => <option key={d.domain} value={d.domain}>@{d.domain}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Password</label>
                    <input type="password" placeholder="••••••" value={newPass} onChange={e => setNewPass(e.target.value)} className="text-input" />
                  </div>
                  <button className="btn-primary" style={{ height: 36 }} onClick={handleCreateFtp}>Add FTP Account</button>
                </div>
              </PageCard>
            </div>
          )}

          {/* ── BACKUPS ────────────────────────────────────────────────────── */}
          {currentPage === 'backups' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Files › Backups</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Backup Manager</h2>
                  <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={handleCreateBackup}>Generate Backup</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px 20px' }}>Backup Name</th><th style={{ padding: '8px 12px' }}>Type</th><th style={{ padding: '8px 12px' }}>Size</th><th style={{ padding: '8px 12px' }}>Status</th><th style={{ padding: '8px 12px' }}>Created</th><th style={{ padding: '8px 12px', width: 80 }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {backups.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No backups yet. Click "Generate Backup" to start.</td></tr>
                    ) : backups.map((b: any) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px 20px', fontWeight: 500, fontSize: 11 }}>💾 {b.name}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{b.type}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{b.size_bytes > 0 ? `${(b.size_bytes/1024/1024).toFixed(2)} MB` : '—'}</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ color: b.status === 'completed' ? '#22c55e' : b.status === 'failed' ? '#f56c6c' : '#f97316', fontWeight: 700, fontSize: 11 }}>{b.status}</span></td>
                        <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 11 }}>{new Date(b.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px' }}><button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 11, color: '#f56c6c' }} onClick={() => handleDeleteBackup(b.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── MYSQL DATABASES ────────────────────────────────────────────── */}
          {currentPage === 'db' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Databases › MySQL Databases</nav>
              <PageCard title="MySQL Databases & Users">
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Databases</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Database Name</th><th style={{ padding: '8px 12px', width: 80 }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {databases.length === 0 ? (
                      <tr><td colSpan={2} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>No databases yet.</td></tr>
                    ) : databases.map(db => (
                      <tr key={db} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>🗄️ {db}</td>
                        <td style={{ padding: '8px 12px' }}><button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 11, color: '#f56c6c' }} onClick={() => handleDeleteMysqlDb(db)}>Drop</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">New Database</label>
                    <div className="form-input-container">
                      <span className="domain-suffix" style={{ marginRight: 4, fontWeight: 'bold' }}>{currentUser}_</span>
                      <input type="text" placeholder="e.g. blog" value={newDb} onChange={e => setNewDb(e.target.value)} className="text-input" />
                    </div>
                  </div>
                  <button className="btn-primary" style={{ padding: '7px 14px' }} onClick={handleCreateDatabase}>Create DB</button>
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, borderTop: '1px solid #e4e7ed', paddingTop: 12 }}>MySQL Users</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}><th style={{ padding: '8px 12px' }}>Username</th></tr></thead>
                  <tbody>
                    {mysqlUsers.length === 0 ? (
                      <tr><td style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>No MySQL users yet.</td></tr>
                    ) : mysqlUsers.map(u2 => (
                      <tr key={u2} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>👤 {u2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>{currentUser}_username</label>
                    <input type="text" className="text-input" placeholder="username" value={newMysqlUser} onChange={e => setNewMysqlUser(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Password</label>
                    <input type="password" className="text-input" placeholder="••••••" value={newMysqlUserPass} onChange={e => setNewMysqlUserPass(e.target.value)} />
                  </div>
                  <button className="btn-secondary" style={{ padding: '7px 14px' }} onClick={handleCreateMysqlUser}>Create User</button>
                </div>
                {mysqlUsers.length > 0 && databases.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, borderTop: '1px solid #e4e7ed', paddingTop: 12 }}>Assign User to Database</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: 11 }}>Database</label><select className="theme-select" value={assignDb} onChange={e => setAssignDb(e.target.value)} style={{ width: '100%', padding: '6px' }}><option value="">— select —</option>{databases.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                      <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: 11 }}>User</label><select className="theme-select" value={assignUser} onChange={e => setAssignUser(e.target.value)} style={{ width: '100%', padding: '6px' }}><option value="">— select —</option>{mysqlUsers.map(u2 => <option key={u2} value={u2}>{u2}</option>)}</select></div>
                      <button className="btn-primary" style={{ padding: '7px 14px' }} onClick={handleAssignDbUser}>Grant ALL</button>
                    </div>
                  </>
                )}
              </PageCard>
            </div>
          )}

          {/* ── phpMyAdmin ──────────────────────────────────────────────────── */}
          {currentPage === 'phpmyadmin' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Databases › phpMyAdmin</nav>
              <PageCard title="phpMyAdmin">
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>phpMyAdmin is a web-based MySQL administration tool. It opens in a new tab.</p>
                <button className="btn-primary" onClick={() => window.open('http://localhost:8080', '_blank')}>Open phpMyAdmin →</button>
              </PageCard>
            </div>
          )}

          {/* ── ADDON DOMAINS ──────────────────────────────────────────────── */}
          {currentPage === 'domain' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Domains › Addon Domains</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Domains</h2>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '10px 20px' }}>Domain</th><th style={{ padding: '10px 12px' }}>Document Root</th><th style={{ padding: '10px 12px' }}>Type</th>
                  </tr></thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '10px 20px', fontWeight: 500 }}>🌐 {d.domain}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>{d.document_root}</td>
                        <td style={{ padding: '10px 12px' }}>{d.is_primary ? <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Primary</span> : <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>Addon</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '18px 20px', background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add Addon Domain</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 10, alignItems: 'flex-end' }}>
                    <div>
                      <label className="form-label">New Domain Name</label>
                      <input type="text" placeholder="e.g. newbrand.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} className="text-input" />
                    </div>
                    <div>
                      <label className="form-label">Document Root</label>
                      <input type="text" value={`/home/testuser/public_html/${newDomain || ''}`} readOnly className="text-input" style={{ background: '#f5f7fa', color: '#9ca3af' }} />
                    </div>
                    <button className="btn-primary" style={{ height: 36 }} onClick={handleCreateDomain}>Add Domain</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── WORDPRESS TOOLKIT ──────────────────────────────────────────── */}
          {currentPage === 'wordpress' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Files › WordPress Toolkit</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c', display: 'flex', alignItems: 'center', gap: 6 }}>
                      WordPress Management
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Deploy, configure, and manage WordPress installations in your public folder.</p>
                  </div>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => {
                    if (domains.length > 0) setWpDomain(domains[0].domain);
                    setShowWpInstallDialog(true);
                  }}>
                    Install WordPress
                  </button>
                </div>

                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2b4c', marginBottom: 12 }}>Active Installations</h3>
                  {wpInstallations.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed #ccd0d7', borderRadius: 6, background: '#fafafa' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>ℹ️</div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 14, color: '#374151' }}>No installations found</h4>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Create your first site using the WordPress quick install feature.</p>
                      <button className="btn-primary" onClick={() => {
                        if (domains.length > 0) setWpDomain(domains[0].domain);
                        setShowWpInstallDialog(true);
                      }}>Install WordPress</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {wpInstallations.map(wp => (
                        <div key={wp.id} style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          background: '#fff',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{ background: '#f8f9fa', padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 14, color: '#111827' }}>{wp.site_title}</strong>
                            <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                              {wp.status}
                            </span>
                          </div>
                          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 120px', gap: 16, alignItems: 'center' }}>
                            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div>🌐 URL: <a href={`http://${wp.domain}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 500 }}>http://{wp.domain}</a></div>
                              <div>📁 Path: <code style={{ background: '#f3f4f6', padding: '2px 4px', borderRadius: 3 }}>{wp.path}</code></div>
                              <div>🗄️ Database: <code>{wp.db_name}</code></div>
                              <div>👤 Admin Username: <strong>{wp.admin_user}</strong></div>
                              <div>ℹ️ WordPress Version: <code>{wp.version}</code></div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => window.open(`http://${wp.domain}`, '_blank')}>
                                Open Site ↗
                              </button>
                              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }} onClick={() => handleWordPressUninstall(wp.id)}>
                                Uninstall
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Install Dialog Modal */}
              {showWpInstallDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                  <div style={{ background: '#fff', padding: 24, borderRadius: 6, width: 480, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 16, color: '#1a2b4c' }}>Install WordPress</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Installation Domain</label>
                        <select className="theme-select" style={{ width: '100%', padding: 8 }} value={wpDomain} onChange={e => setWpDomain(e.target.value)}>
                          {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Installation Directory (optional)</label>
                        <input type="text" className="text-input" placeholder="e.g. blog (leave empty for root)" value={wpInstallDir} onChange={e => setWpInstallDir(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Site Title</label>
                        <input type="text" className="text-input" value={wpSiteTitle} onChange={e => setWpSiteTitle(e.target.value)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Admin Username</label>
                          <input type="text" className="text-input" value={wpAdminUser} onChange={e => setWpAdminUser(e.target.value)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Admin Password</label>
                          <input type="password" className="text-input" value={wpAdminPass} onChange={e => setWpAdminPass(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Admin Email</label>
                        <input type="email" className="text-input" value={wpAdminEmail} onChange={e => setWpAdminEmail(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => setShowWpInstallDialog(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleWordPressInstall}>Install WordPress</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REDIRECTS ──────────────────────────────────────────────────── */}
          {currentPage === 'redirect' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Domains › Redirects</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Redirects</h2>
                </div>
                <div style={{ padding: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                    <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Domain</th><th style={{ padding: '8px 12px' }}>Type</th><th style={{ padding: '8px 12px' }}>Redirect To</th><th style={{ padding: '8px 12px', width: 80 }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {redirects.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No redirects configured.</td></tr>
                      ) : redirects.map((r: any) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>🔗 {r.domain}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.redirect_type} Permanent</td>
                          <td style={{ padding: '8px 12px', color: '#2563eb', wordBreak: 'break-all' }}><a href={r.redirect_url} target="_blank" rel="noreferrer">{r.redirect_url}</a></td>
                          <td style={{ padding: '8px 12px' }}><button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 11, color: '#f56c6c' }} onClick={() => handleDeleteRedirect(r.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, paddingTop: 12, borderTop: '1px solid #e4e7ed' }}>Add Redirect</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 2fr auto', gap: 10, alignItems: 'flex-end' }}>
                    <div>
                      <label className="form-label">Type</label>
                      <select className="theme-select" value={redirectType} onChange={e => setRedirectType(e.target.value)} style={{ padding: '6px 8px' }}>
                        <option value="301">301 Permanent</option>
                        <option value="302">302 Temporary</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Domain</label>
                      <select className="theme-select" value={redirectDomain} onChange={e => setRedirectDomain(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                        {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Destination URL</label>
                      <input type="text" placeholder="https://newbrand.com/" value={redirectUrl} onChange={e => setRedirectUrl(e.target.value)} className="text-input" />
                    </div>
                    <button className="btn-primary" style={{ height: 36 }} onClick={handleCreateRedirect}>Add Redirect</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DNS ZONE EDITOR ────────────────────────────────────────────── */}
          {currentPage === 'dns' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Domains › DNS Zone Editor</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>DNS Zone Editor</h2>
                  <select className="theme-select" value={dnsSelectedDomain} onChange={e => { setDnsSelectedDomain(e.target.value); fetchDnsRecords(e.target.value); }} style={{ padding: '5px 8px' }}>
                    {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                  </select>
                </div>
                <div style={{ padding: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                    <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Name</th><th style={{ padding: '8px 12px' }}>Type</th><th style={{ padding: '8px 12px' }}>Content</th><th style={{ padding: '8px 12px' }}>TTL</th><th style={{ padding: '8px 12px', width: 80 }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {dnsRecords.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No DNS records for this zone.</td></tr>
                      ) : dnsRecords.map((r: any) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.name}</td>
                          <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 3, background: '#e3f2fd', color: '#1565c0', fontSize: 10, fontWeight: 700 }}>{r.type}</span></td>
                          <td style={{ padding: '8px 12px', color: '#6b7280', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.ttl}s</td>
                          <td style={{ padding: '8px 12px' }}><button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 11, color: '#f56c6c' }} onClick={() => handleDeleteDnsRecord(r.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, paddingTop: 12, borderTop: '1px solid #e4e7ed' }}>Add DNS Record</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div><label className="form-label" style={{ fontSize: 11 }}>Name</label><input type="text" className="text-input" placeholder={dnsSelectedDomain} value={dnsNewName} onChange={e => setDnsNewName(e.target.value)} /></div>
                    <div><label className="form-label" style={{ fontSize: 11 }}>Type</label><select className="theme-select" value={dnsNewType} onChange={e => setDnsNewType(e.target.value)} style={{ width: '100%', padding: '6px' }}>{['A','AAAA','CNAME','MX','TXT','NS','SRV','CAA'].map(t => <option key={t}>{t}</option>)}</select></div>
                    <div><label className="form-label" style={{ fontSize: 11 }}>Content</label><input type="text" className="text-input" placeholder="203.0.113.5" value={dnsNewContent} onChange={e => setDnsNewContent(e.target.value)} /></div>
                    <div><label className="form-label" style={{ fontSize: 11 }}>TTL</label><input type="number" className="text-input" value={dnsNewTtl} onChange={e => setDnsNewTtl(Number(e.target.value))} /></div>
                  </div>
                  {(dnsNewType === 'MX' || dnsNewType === 'SRV') && (
                    <div style={{ marginBottom: 8 }}><label className="form-label" style={{ fontSize: 11 }}>Priority</label><input type="number" className="text-input" style={{ width: 120 }} value={dnsNewPriority} onChange={e => setDnsNewPriority(Number(e.target.value))} /></div>
                  )}
                  <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleAddDnsRecord}>Add Record</button>
                </div>
              </div>
            </div>
          )}

          {/* ── VISITORS ───────────────────────────────────────────────────── */}
          {currentPage === 'visitors' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Metrics › Visitors</nav>
              <PageCard title={`Domain Access Logs — ${primaryDomainName}`}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Client IP</th><th style={{ padding: '6px 8px' }}>Time</th><th style={{ padding: '6px 8px' }}>Method</th><th style={{ padding: '6px 8px' }}>Path</th><th style={{ padding: '6px 8px' }}>Status</th><th style={{ padding: '6px 8px' }}>Size</th><th style={{ padding: '6px 8px' }}>User Agent</th>
                  </tr></thead>
                  <tbody>
                    {visitors.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No access logs found.</td></tr>
                    ) : visitors.map((v: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 500 }}>👤 {v.ip}</td>
                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{new Date(v.time).toLocaleTimeString()}</td>
                        <td style={{ padding: '6px 8px' }}><span style={{ padding: '2px 6px', borderRadius: 3, fontSize: 10, background: v.method === 'POST' ? '#e3f2fd' : '#e8f5e9', color: v.method === 'POST' ? '#1565c0' : '#2e7d32', fontWeight: 700 }}>{v.method}</span></td>
                        <td style={{ padding: '6px 8px', fontWeight: 500 }}>{v.path}</td>
                        <td style={{ padding: '6px 8px' }}><span style={{ color: v.status >= 400 ? '#f56c6c' : '#67c23a', fontWeight: 700 }}>{v.status}</span></td>
                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{v.size > 0 ? `${(v.size/1024).toFixed(1)} KB` : '—'}</td>
                        <td style={{ padding: '6px 8px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.ua}>{v.ua}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PageCard>
            </div>
          )}

          {/* ── BANDWIDTH ──────────────────────────────────────────────────── */}
          {currentPage === 'bandwidth' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Metrics › Bandwidth</nav>
              <PageCard title="Bandwidth Utilization">
                <p style={{ color: '#6b7280', marginBottom: 14, fontSize: 12 }}>HTTP bandwidth consumption per month based on Nginx access logs.</p>
                <div style={{ display: 'flex', gap: 8, height: 160, alignItems: 'flex-end', borderBottom: '2px solid #ccd0d7', paddingBottom: 4, marginBottom: 12 }}>
                  {bandwidth.map((item: any, idx: number) => {
                    const total = item.http + item.ftp + item.mail;
                    const maxBw = 200;
                    const heightPct = Math.min((total / maxBw) * 100, 100);
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${heightPct}%`, background: '#ff6c2c', borderRadius: '3px 3px 0 0' }} title={`${item.http} MB`} />
                        <span style={{ fontSize: 8, color: '#6b7280', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap', height: 12 }}>{item.month.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ff6c2c', borderRadius: 2 }} /> HTTP Traffic</span>
                </div>
              </PageCard>
            </div>
          )}

          {/* ── SSL/TLS ────────────────────────────────────────────────────── */}
          {currentPage === 'ssl' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Security › SSL/TLS</nav>
              <PageCard title="SSL/TLS — AutoSSL Certificate Provisioning">
                <p style={{ color: '#6b7280', marginBottom: 14, fontSize: 12 }}>Automate Let's Encrypt SSL/TLS certificates for your domains via Nginx virtual host blocks.</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Domain</th><th style={{ padding: '8px 12px' }}>SSL Issuer</th><th style={{ padding: '8px 12px' }}>Expiration</th><th style={{ padding: '8px 12px', width: 100 }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {domains.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No domains registered.</td></tr>
                    ) : domains.map(d => {
                      const sslInfo = sslStatusList.find(s => s.domain === d.domain);
                      return (
                        <tr key={d.domain} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>🔒 {d.domain}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{sslInfo?.issuer || 'Self-Signed (Untrusted)'}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{sslInfo?.expires_at ? new Date(sslInfo.expires_at).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: '8px 12px' }}><button className="btn-primary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleIssueSSL(d.domain)}>AutoSSL</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </PageCard>
            </div>
          )}

          {/* ── TERMINAL ───────────────────────────────────────────────────── */}
          {currentPage === 'terminal' && (
            <Suspense fallback={<div style={{ padding: 24, color: '#8b949e', background: '#0d1117', height: '100%' }}>Loading terminal…</div>}>
              <XtermTerminal token={token!} />
            </Suspense>
          )}

          {/* ── CRON JOBS ──────────────────────────────────────────────────── */}
          {currentPage === 'cron' && (
            <div style={{ padding: 24 }}>
              <nav style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Home › Advanced › Cron Jobs</nav>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2b4c' }}>Cron Jobs</h2>
                </div>
                <div style={{ padding: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                    <thead><tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Schedule (min hr day mo wd)</th><th style={{ padding: '8px 12px' }}>Command</th><th style={{ padding: '8px 12px', width: 70 }}>Status</th><th style={{ padding: '8px 12px', width: 70 }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {cronJobs.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No cron jobs configured.</td></tr>
                      ) : cronJobs.map((job: any) => (
                        <tr key={job.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{job.minute} {job.hour} {job.day} {job.month} {job.weekday}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.command}</td>
                          <td style={{ padding: '8px 12px' }}><span style={{ color: job.enabled ? '#22c55e' : '#f56c6c', fontWeight: 700, fontSize: 11 }}>{job.enabled ? 'Active' : 'Off'}</span></td>
                          <td style={{ padding: '8px 12px' }}><button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 11, color: '#f56c6c' }} onClick={() => handleDeleteCron(job.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, paddingTop: 12, borderTop: '1px solid #e4e7ed' }}>Add New Cron Job</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 10 }}>
                    {([['Minute', cronMinute, setCronMinute], ['Hour', cronHour, setCronHour], ['Day', cronDay, setCronDay], ['Month', cronMonth, setCronMonth], ['Weekday', cronWeekday, setCronWeekday]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                      <div key={label}><label className="form-label" style={{ fontSize: 11 }}>{label}</label><input type="text" className="text-input" value={val} onChange={e => setter(e.target.value)} placeholder="*" /></div>
                    ))}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Command</label>
                    <input type="text" className="text-input" placeholder="/usr/bin/php /home/user/cron.php" value={cronCommand} onChange={e => setCronCommand(e.target.value)} />
                  </div>
                  <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleCreateCron}>Add Cron Job</button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── TOAST ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`toast-alert ${toast.type === 'error' ? 'error' : ''}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: '4px', border: '1px solid #ccd0d7',
  fontSize: '13px', width: '100%', boxSizing: 'border-box', outline: 'none'
};
const labelStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px'
};
const fgStyle: React.CSSProperties = { marginBottom: '12px' };
const tableHead: React.CSSProperties = {
  background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left'
};
const thStyle: React.CSSProperties = { padding: '8px', fontSize: '12px', color: '#374151', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px', fontSize: '12px', color: '#4b5563', borderBottom: '1px solid #f0f2f5' };

function DefaultAddressModal({ token, domains, onClose, triggerToast, pageMode = false }: {
  token: string; domains: any[]; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [action, setAction] = useState('discard');
  const [domain, setDomain] = useState(domains[0]?.domain || '');
  const [forwardTo, setForwardTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/cpanel/email/default-address`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : {}).then((d: any) => {
      if (d.action) setAction(d.action);
      if (d.domain) setDomain(d.domain);
      if (d.forward_to) setForwardTo(d.forward_to);
    });
  }, [token]);

  const handleSave = async () => {
    if (!domain) { triggerToast('Select a domain', 'error'); return; }
    if (action === 'forward' && !forwardTo) { triggerToast('Enter a forwarding address', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/default-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain, action, forwardTo: action === 'forward' ? forwardTo : undefined })
      });
      const data = await res.json();
      if (res.ok) { triggerToast('Default address saved'); }
      else { triggerToast(data.error || 'Failed to save', 'error'); }
    } catch { triggerToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const innerBody = (
    <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
            Set what happens to mail sent to an address that does not exist on this domain.
          </p>
          <div style={fgStyle}>
            <label style={labelStyle}>Domain</label>
            <select value={domain} onChange={e => setDomain(e.target.value)} style={inputStyle}>
              {domains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
            </select>
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Action for unrouted mail</label>
            {[
              { val: 'discard', label: 'Discard — silently delete the message' },
              { val: 'bounce', label: 'Bounce — return the message to sender' },
              { val: 'forward', label: 'Forward to email address' }
            ].map(opt => (
              <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="radio" name="da_action" value={opt.val} checked={action === opt.val} onChange={() => setAction(opt.val)} />
                {opt.label}
              </label>
            ))}
          </div>
          {action === 'forward' && (
            <div style={fgStyle}>
              <label style={labelStyle}>Forward To</label>
              <input style={inputStyle} type="email" placeholder="backup@example.com" value={forwardTo} onChange={e => setForwardTo(e.target.value)} />
            </div>
          )}
    </div>
  );
  if (pageMode) {
    return (
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#1a2b4c', fontSize: 15 }}>Default Address (Catch-All)</div>
        {innerBody}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    );
  }
  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={{ width: '520px', maxWidth: '95%' }}>
        <div className="modal-header"><span>Default Address (Catch-All)</span><button className="close-btn" onClick={onClose}>×</button></div>
        {innerBody}
        <div className="modal-footer"><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
      </div>
    </div>
  );
}

// ─── 2. Mailing Lists ────────────────────────────────────────────────────────

function MailingListsModal({ token, domains, onClose, triggerToast, pageMode = false }: {
  token: string; domains: any[]; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [lists, setLists] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [mlName, setMlName] = useState('');
  const [mlDomain, setMlDomain] = useState(domains[0]?.domain || '');
  const [mlDesc, setMlDesc] = useState('');
  const [mlAdmin, setMlAdmin] = useState('');
  const [mlPass, setMlPass] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subEmail, setSubEmail] = useState('');

  const load = async () => {
    const res = await fetch(`${API_BASE}/cpanel/email/mailing-lists`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setLists(await res.json());
  };

  useEffect(() => { load(); }, []);

  const loadSubs = async (id: string) => {
    const res = await fetch(`${API_BASE}/cpanel/email/mailing-lists/${id}/subscribers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setSubscribers(await res.json());
  };

  const handleCreate = async () => {
    if (!mlName || !mlDomain || !mlAdmin || !mlPass) { triggerToast('All fields required', 'error'); return; }
    const res = await fetch(`${API_BASE}/cpanel/email/mailing-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listName: mlName, domain: mlDomain, description: mlDesc, adminEmail: mlAdmin, password: mlPass })
    });
    const data = await res.json();
    if (res.ok) {
      triggerToast('Mailing list created');
      setShowCreate(false); setMlName(''); setMlDesc(''); setMlAdmin(''); setMlPass('');
      load();
    } else { triggerToast(data.error || 'Failed', 'error'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mailing list?')) return;
    const res = await fetch(`${API_BASE}/cpanel/email/mailing-lists/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { triggerToast('Deleted'); load(); if (selected?.id === id) setSelected(null); }
    else triggerToast('Failed to delete', 'error');
  };

  const handleAddSub = async () => {
    if (!subEmail || !selected) return;
    const res = await fetch(`${API_BASE}/cpanel/email/mailing-lists/${selected.id}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: subEmail })
    });
    const data = await res.json();
    if (res.ok) { triggerToast('Subscriber added'); setSubEmail(''); loadSubs(selected.id); }
    else triggerToast(data.error || 'Failed', 'error');
  };

  const handleRemoveSub = async (email: string) => {
    if (!selected) return;
    const res = await fetch(`${API_BASE}/cpanel/email/mailing-lists/${selected.id}/subscribers/${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { triggerToast('Subscriber removed'); loadSubs(selected.id); }
    else triggerToast('Failed', 'error');
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '720px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Mailing Lists</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          {selected ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => { setSelected(null); setSubscribers([]); }}>Back to lists</button>
                <strong style={{ fontSize: '14px' }}>Subscribers: {selected.list_name}@{selected.domain}</strong>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>({subscribers.length})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder="new@subscriber.com" value={subEmail} onChange={e => setSubEmail(e.target.value)} />
                <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={handleAddSub}>Add</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={tableHead}><th style={thStyle}>Email</th><th style={thStyle}>Subscribed</th><th style={thStyle}>Actions</th></tr></thead>
                <tbody>
                  {subscribers.length === 0
                    ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', padding: '20px' }}>No subscribers yet.</td></tr>
                    : subscribers.map((s: any) => (
                      <tr key={s.id}>
                        <td style={tdStyle}>{s.email}</td>
                        <td style={tdStyle}>{new Date(s.subscribed_at).toLocaleDateString()}</td>
                        <td style={tdStyle}><button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleRemoveSub(s.email)}>Remove</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setShowCreate(!showCreate)}>+ Create List</button>
              </div>
              {showCreate && (
                <div style={{ background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={fgStyle}><label style={labelStyle}>List Name</label><input style={inputStyle} value={mlName} onChange={e => setMlName(e.target.value)} placeholder="newsletter" /></div>
                    <div style={fgStyle}><label style={labelStyle}>Domain</label>
                      <select style={inputStyle} value={mlDomain} onChange={e => setMlDomain(e.target.value)}>
                        {domains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
                      </select>
                    </div>
                    <div style={fgStyle}><label style={labelStyle}>Admin Email</label><input style={inputStyle} type="email" value={mlAdmin} onChange={e => setMlAdmin(e.target.value)} placeholder="admin@example.com" /></div>
                    <div style={fgStyle}><label style={labelStyle}>Password</label><input style={inputStyle} type="password" value={mlPass} onChange={e => setMlPass(e.target.value)} /></div>
                    <div style={{ ...fgStyle, gridColumn: '1/-1' }}><label style={labelStyle}>Description</label><input style={inputStyle} value={mlDesc} onChange={e => setMlDesc(e.target.value)} placeholder="Optional description" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => setShowCreate(false)}>Cancel</button>
                    <button className="btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={handleCreate}>Create</button>
                  </div>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={tableHead}><th style={thStyle}>List Address</th><th style={thStyle}>Description</th><th style={thStyle}>Admin</th><th style={thStyle}>Created</th><th style={thStyle}>Actions</th></tr></thead>
                <tbody>
                  {lists.length === 0
                    ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No mailing lists found.</td></tr>
                    : lists.map((l: any) => (
                      <tr key={l.id}>
                        <td style={tdStyle}><span style={{ color: 'var(--cpanel-orange)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setSelected(l); loadSubs(l.id); }}>{l.list_name}@{l.domain}</span></td>
                        <td style={tdStyle}>{l.description || '—'}</td>
                        <td style={tdStyle}>{l.admin_email}</td>
                        <td style={tdStyle}>{new Date(l.created_at).toLocaleDateString()}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => { setSelected(l); loadSubs(l.id); }}>Subscribers</button>
                            <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleDelete(l.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 3. Track Delivery ───────────────────────────────────────────────────────

function TrackDeliveryModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/delivery-log?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } else triggerToast('Failed to load delivery logs', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      delivered: { bg: '#d1fae5', color: '#065f46' },
      deferred: { bg: '#fef3c7', color: '#92400e' },
      bounced: { bg: '#fee2e2', color: '#991b1b' },
      failed: { bg: '#fee2e2', color: '#991b1b' }
    };
    const c = colors[status] || { bg: '#f3f4f6', color: '#374151' };
    return <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{status}</span>;
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '760px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Track Delivery — Last 50 Messages</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Total logged messages: {total}</span>
            <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={tableHead}>
                <th style={thStyle}>Sender</th>
                <th style={thStyle}>Recipient</th>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Time</th>
              </tr></thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
                  : logs.length === 0
                    ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No delivery records found.</td></tr>
                    : logs.map((l: any) => (
                      <tr key={l.id}>
                        <td style={tdStyle}>{l.sender}</td>
                        <td style={tdStyle}>{l.recipient}</td>
                        <td style={{ ...tdStyle, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.subject || '(no subject)'}</td>
                        <td style={tdStyle}>{statusBadge(l.status)}</td>
                        <td style={tdStyle}>{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 4 & 5. Email Filters (global + account scope) ──────────────────────────

function EmailFiltersModal({ token, scope, title, onClose, triggerToast, pageMode = false }: {
  token: string; scope: 'global' | 'account'; title: string;
  onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [filters, setFilters] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [fName, setFName] = useState('');
  const [rules, setRules] = useState<{ field: string; operator: string; value: string }[]>([{ field: 'from', operator: 'contains', value: '' }]);
  const [actionType, setActionType] = useState('move_to_folder');
  const [actionValue, setActionValue] = useState('');

  const load = async () => {
    const res = await fetch(`${API_BASE}/cpanel/email/filters?scope=${scope}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setFilters(await res.json());
  };

  useEffect(() => { load(); }, []);

  const addRule = () => setRules(r => [...r, { field: 'from', operator: 'contains', value: '' }]);
  const updateRule = (i: number, key: string, val: string) => setRules(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  const removeRule = (i: number) => setRules(r => r.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!fName || rules.some(r => !r.value)) { triggerToast('Fill all filter fields', 'error'); return; }
    const res = await fetch(`${API_BASE}/cpanel/email/filters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filterName: fName, scope, rules, actionType, actionValue })
    });
    const data = await res.json();
    if (res.ok) {
      triggerToast('Filter created');
      setShowCreate(false); setFName(''); setRules([{ field: 'from', operator: 'contains', value: '' }]); setActionType('move_to_folder'); setActionValue('');
      load();
    } else triggerToast(data.error || 'Failed', 'error');
  };

  const handleToggle = async (f: any) => {
    const res = await fetch(`${API_BASE}/cpanel/email/filters/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !f.enabled })
    });
    if (res.ok) { triggerToast(`Filter ${!f.enabled ? 'enabled' : 'disabled'}`); load(); }
    else triggerToast('Failed to toggle', 'error');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this filter?')) return;
    const res = await fetch(`${API_BASE}/cpanel/email/filters/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { triggerToast('Filter deleted'); load(); }
    else triggerToast('Failed', 'error');
  };

  const rulesSummary = (r: any[]) => r.map((x: any) => `${x.field} ${x.operator} "${x.value}"`).join(', ');

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '740px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>{title}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setShowCreate(!showCreate)}>+ Create Filter</button>
          </div>
          {showCreate && (
            <div style={{ background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
              <div style={fgStyle}><label style={labelStyle}>Filter Name</label><input style={inputStyle} value={fName} onChange={e => setFName(e.target.value)} placeholder="My Filter" /></div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Rules</label>
                {rules.map((rule, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                    <select style={{ ...inputStyle, width: 'auto', flex: '0 0 100px' }} value={rule.field} onChange={e => updateRule(i, 'field', e.target.value)}>
                      <option value="from">From</option><option value="to">To</option><option value="subject">Subject</option><option value="body">Body</option>
                    </select>
                    <select style={{ ...inputStyle, width: 'auto', flex: '0 0 110px' }} value={rule.operator} onChange={e => updateRule(i, 'operator', e.target.value)}>
                      <option value="contains">contains</option><option value="equals">equals</option><option value="starts_with">starts with</option><option value="regex">regex</option>
                    </select>
                    <input style={{ ...inputStyle, flex: 1 }} value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="value" />
                    {rules.length > 1 && <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => removeRule(i)}>-</button>}
                  </div>
                ))}
                <button className="btn-secondary" style={{ padding: '3px 10px', fontSize: '11px' }} onClick={addRule}>+ Add Rule</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={fgStyle}>
                  <label style={labelStyle}>Action</label>
                  <select style={inputStyle} value={actionType} onChange={e => setActionType(e.target.value)}>
                    <option value="move_to_folder">Move to Folder</option>
                    <option value="forward_to">Forward to</option>
                    <option value="delete">Delete</option>
                    <option value="mark_as_spam">Mark as Spam</option>
                    <option value="discard">Discard</option>
                  </select>
                </div>
                {(actionType === 'move_to_folder' || actionType === 'forward_to') && (
                  <div style={fgStyle}>
                    <label style={labelStyle}>{actionType === 'forward_to' ? 'Email address' : 'Folder name'}</label>
                    <input style={inputStyle} value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder={actionType === 'forward_to' ? 'user@example.com' : 'Spam'} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={handleCreate}>Create Filter</button>
              </div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={tableHead}><th style={thStyle}>Name</th><th style={thStyle}>Rules</th><th style={thStyle}>Action</th><th style={thStyle}>Enabled</th><th style={thStyle}>Actions</th></tr></thead>
            <tbody>
              {filters.length === 0
                ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No filters found.</td></tr>
                : filters.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{f.filter_name}</td>
                    <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>{rulesSummary(f.rules)}</td>
                    <td style={tdStyle}>{f.action_type}{f.action_value ? `: ${f.action_value}` : ''}</td>
                    <td style={tdStyle}>
                      <button onClick={() => handleToggle(f)} style={{ background: f.enabled ? '#d1fae5' : '#f3f4f6', color: f.enabled ? '#065f46' : '#6b7280', border: 'none', borderRadius: '10px', padding: '2px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                        {f.enabled ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleDelete(f.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 6. Email Deliverability ─────────────────────────────────────────────────

function EmailDeliverabilityModal({ token, domains, onClose, triggerToast, pageMode = false }: {
  token: string; domains: any[]; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [selectedDomain, setSelectedDomain] = useState(domains[0]?.domain || '');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async (d: string) => {
    if (!d) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/deliverability?domain=${encodeURIComponent(d)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setData(await res.json());
      else triggerToast('Failed to load deliverability data', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedDomain) load(selectedDomain); }, [selectedDomain]);

  const StatusCard = ({ label, rec }: { label: string; rec: { status: string; recommendation: string } }) => (
    <div style={{ border: `1px solid ${rec.status === 'ok' ? '#a7f3d0' : '#fca5a5'}`, borderRadius: '8px', padding: '14px', marginBottom: '12px', background: rec.status === 'ok' ? '#f0fdf4' : '#fff5f5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>{label}</span>
        <span style={{ background: rec.status === 'ok' ? '#d1fae5' : '#fee2e2', color: rec.status === 'ok' ? '#065f46' : '#991b1b', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
          {rec.status === 'ok' ? 'OK' : 'Missing'}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: '#4b5563', margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{rec.recommendation}</p>
    </div>
  );

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '660px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Email Deliverability</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ ...fgStyle, marginBottom: '18px' }}>
            <label style={labelStyle}>Select Domain</label>
            <select style={inputStyle} value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}>
              {domains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
            </select>
          </div>
          {loading && <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Checking records...</p>}
          {!loading && data && (
            <div>
              <StatusCard label="SPF" rec={data.spf} />
              <StatusCard label="DKIM" rec={data.dkim} />
              <StatusCard label="DMARC" rec={data.dmarc} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 7. Address Importer ─────────────────────────────────────────────────────

function AddressImporterModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState<any[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: any[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const handlePreview = () => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
      const [email, password, quota_mb] = line.split(',').map(s => s.trim());
      return { email: email || '', password: password || '', quota_mb: quota_mb ? parseInt(quota_mb) : 250 };
    });
    setParsed(rows);
    setPreviewed(true);
  };

  const handleImport = async () => {
    if (parsed.length === 0) { triggerToast('No data to import', 'error'); return; }
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accounts: parsed })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        triggerToast(`Imported ${data.imported} account(s)`);
      } else triggerToast(data.error || 'Import failed', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setImporting(false); }
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '640px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Address Importer</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            Paste CSV data in the format: <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>email,password,quota_mb</code> — one account per line. quota_mb is optional (default 250).
          </p>
          <div style={fgStyle}>
            <label style={labelStyle}>CSV Data</label>
            <textarea
              style={{ ...inputStyle, height: '140px', fontFamily: 'monospace', resize: 'vertical' }}
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setPreviewed(false); setResult(null); }}
              placeholder={"info@example.com,SecurePass1,500\nsupport@example.com,Pass2024,250"}
            />
          </div>
          {!previewed && (
            <button className="btn-secondary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={handlePreview}>Preview</button>
          )}
          {previewed && parsed.length > 0 && (
            <div>
              <div style={{ marginBottom: '10px' }}>
                <strong style={{ fontSize: '13px' }}>Preview: {parsed.length} row(s)</strong>
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={tableHead}><th style={thStyle}>Email</th><th style={thStyle}>Password</th><th style={thStyle}>Quota (MB)</th></tr></thead>
                  <tbody>
                    {parsed.map((row, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{row.email || <span style={{ color: '#ef4444' }}>missing</span>}</td>
                        <td style={tdStyle}>{row.password ? '••••••' : <span style={{ color: '#ef4444' }}>missing</span>}</td>
                        <td style={tdStyle}>{row.quota_mb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {result && (
            <div style={{ marginTop: '12px', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '12px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: 600 }}>
                Imported: {result.imported} &nbsp;|&nbsp; Failed: {result.failed.length}
              </p>
              {result.failed.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '12px', color: '#991b1b' }}>
                  {result.failed.map((f: any, i: number) => <li key={i}>{f.email}: {f.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {previewed && !result && (
            <button className="btn-primary" onClick={handleImport} disabled={importing}>{importing ? 'Importing...' : 'Import'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 8. Spam Filters ─────────────────────────────────────────────────────────

function SpamFiltersModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [rewrite, setRewrite] = useState(false);
  const [whitelist, setWhitelist] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/cpanel/email/spam-config`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then((d: any) => {
      if (!d) return;
      setEnabled(Boolean(d.enabled));
      setThreshold(Number(d.spam_threshold) || 5);
      setRewrite(Boolean(d.rewrite_subject));
      setWhitelist(d.whitelist || '');
      setBlacklist(d.blacklist || '');
    });
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/spam-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled, spam_threshold: threshold, rewrite_subject: rewrite, whitelist, blacklist })
      });
      const data = await res.json();
      if (res.ok) triggerToast('Spam filter settings saved');
      else triggerToast(data.error || 'Failed to save', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '580px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Spam Filters (SpamAssassin)</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '12px', background: '#f8f9fc', borderRadius: '6px', border: '1px solid #e4e7ed' }}>
            <input type="checkbox" id="sf_enabled" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <label htmlFor="sf_enabled" style={{ fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Enable SpamAssassin</label>
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Spam Score Threshold: <strong>{threshold}</strong> (lower = stricter)</label>
            <input type="range" min={1} max={10} step={0.5} value={threshold} onChange={e => setThreshold(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              <span>1 (strict)</span><span>5 (default)</span><span>10 (lenient)</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <input type="checkbox" id="sf_rewrite" checked={rewrite} onChange={e => setRewrite(e.target.checked)} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
            <label htmlFor="sf_rewrite" style={{ fontSize: '13px', cursor: 'pointer' }}>Rewrite subject line with spam score (e.g. ***SPAM***)</label>
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Whitelist — always allow (one email per line)</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'monospace' }} value={whitelist} onChange={e => setWhitelist(e.target.value)} placeholder="friend@example.com" />
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Blacklist — always block (one email per line)</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'monospace' }} value={blacklist} onChange={e => setBlacklist(e.target.value)} placeholder="spammer@bad.com" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 9. Encryption (GPG Keys) ────────────────────────────────────────────────

function EncryptionModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [keys, setKeys] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch(`${API_BASE}/cpanel/email/gpg-keys`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setKeys(await res.json());
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!keyId || !name || !email || !publicKey) { triggerToast('All fields required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/gpg-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyId, name, email, publicKey })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('GPG key added');
        setShowAdd(false); setKeyId(''); setName(''); setEmail(''); setPublicKey('');
        load();
      } else triggerToast(data.error || 'Failed', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this GPG key?')) return;
    const res = await fetch(`${API_BASE}/cpanel/email/gpg-keys/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { triggerToast('Key deleted'); load(); }
    else triggerToast('Failed to delete', 'error');
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '680px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Encryption — GPG Keys</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setShowAdd(!showAdd)}>+ Add Key</button>
          </div>
          {showAdd && (
            <div style={{ background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={fgStyle}><label style={labelStyle}>Key ID</label><input style={inputStyle} value={keyId} onChange={e => setKeyId(e.target.value)} placeholder="A1B2C3D4" /></div>
                <div style={fgStyle}><label style={labelStyle}>Name</label><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" /></div>
                <div style={{ ...fgStyle, gridColumn: '1/-1' }}><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" /></div>
                <div style={{ ...fgStyle, gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Public Key (PGP/GPG block)</label>
                  <textarea style={{ ...inputStyle, height: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} value={publicKey} onChange={e => setPublicKey(e.target.value)} placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={handleAdd} disabled={saving}>{saving ? 'Adding...' : 'Add Key'}</button>
              </div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={tableHead}><th style={thStyle}>Key ID</th><th style={thStyle}>Name</th><th style={thStyle}>Email</th><th style={thStyle}>Added</th><th style={thStyle}>Actions</th></tr></thead>
            <tbody>
              {keys.length === 0
                ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No GPG keys on file.</td></tr>
                : keys.map((k: any) => (
                  <tr key={k.id}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px' }}>{k.key_id}</td>
                    <td style={tdStyle}>{k.name}</td>
                    <td style={tdStyle}>{k.email}</td>
                    <td style={tdStyle}>{new Date(k.created_at).toLocaleDateString()}</td>
                    <td style={tdStyle}><button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleDelete(k.id)}>Delete</button></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 10. BoxTrapper ──────────────────────────────────────────────────────────

function BoxTrapperModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [queueDays, setQueueDays] = useState(7);
  const [whitelist, setWhitelist] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/cpanel/email/boxtrapper`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then((d: any) => {
      if (!d) return;
      setEnabled(Boolean(d.enabled));
      setQueueDays(Number(d.queue_days) || 7);
      setWhitelist(d.whitelist || '');
      setBlacklist(d.blacklist || '');
    });
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/email/boxtrapper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled, queueDays, whitelist, blacklist })
      });
      const data = await res.json();
      if (res.ok) triggerToast('BoxTrapper settings saved');
      else triggerToast(data.error || 'Failed', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '560px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>BoxTrapper</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px' }}>
            BoxTrapper requires all senders not in your whitelist to reply to a verification email before their message is delivered.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '12px', background: '#f8f9fc', borderRadius: '6px', border: '1px solid #e4e7ed' }}>
            <input type="checkbox" id="bt_enabled" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <label htmlFor="bt_enabled" style={{ fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Enable BoxTrapper</label>
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Queue Duration (days) — hold unverified mail for</label>
            <input type="number" style={inputStyle} min={1} max={30} value={queueDays} onChange={e => setQueueDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))} />
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Whitelist — always allow (one email per line)</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'monospace' }} value={whitelist} onChange={e => setWhitelist(e.target.value)} placeholder="trusted@example.com" />
          </div>
          <div style={fgStyle}>
            <label style={labelStyle}>Blacklist — never allow (one email per line)</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'monospace' }} value={blacklist} onChange={e => setBlacklist(e.target.value)} placeholder="blocked@spam.com" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 11. Calendars Config ────────────────────────────────────────────────────

function CalendarsConfigModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/cpanel/caldav/config`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then((d: any) => {
      if (!d) return;
      setEnabled(Boolean(d.enabled));
      setUrl(d.connection_url || '');
    });
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/cpanel/caldav/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('CalDAV configuration saved');
        if (data.config?.connection_url) setUrl(data.config.connection_url);
      } else triggerToast(data.error || 'Failed', 'error');
    } catch { triggerToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '540px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Calendars and Contacts Configuration</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
            Enable CalDAV to allow calendar and contact sync with clients like Apple Calendar, Thunderbird, and Android.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', padding: '12px', background: '#f8f9fc', borderRadius: '6px', border: '1px solid #e4e7ed' }}>
            <input type="checkbox" id="cc_enabled" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <label htmlFor="cc_enabled" style={{ fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Enable CalDAV / CardDAV</label>
          </div>
          {url && (
            <div style={fgStyle}>
              <label style={labelStyle}>Connection URL</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', background: '#f3f4f6' }} value={url} readOnly />
                <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }} onClick={() => { navigator.clipboard.writeText(url); triggerToast('URL copied'); }}>Copy</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 12. Calendars Sharing ───────────────────────────────────────────────────

function CalendarsSharingModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');

  const load = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/cpanel/caldav/calendars`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setCalendars(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggleShare = async (cal: any) => {
    const res = await fetch(`${API_BASE}/cpanel/caldav/calendars/${cal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: cal.name, color: cal.color, is_shared: !cal.is_shared })
    });
    if (res.ok) { triggerToast(`Calendar ${!cal.is_shared ? 'shared' : 'unshared'}`); load(); }
    else triggerToast('Failed to update', 'error');
  };

  const handleEdit = async (id: string) => {
    if (!editName) { triggerToast('Name required', 'error'); return; }
    const res = await fetch(`${API_BASE}/cpanel/caldav/calendars/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: editName, color: editColor })
    });
    if (res.ok) { triggerToast('Calendar updated'); setEditId(null); load(); }
    else triggerToast('Failed to update', 'error');
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '640px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Calendars and Contacts Sharing</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          {loading ? <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Loading...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={tableHead}><th style={thStyle}>Calendar</th><th style={thStyle}>Color</th><th style={thStyle}>Shared</th><th style={thStyle}>Actions</th></tr></thead>
              <tbody>
                {calendars.length === 0
                  ? <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No calendars found. Create one in Calendar Management.</td></tr>
                  : calendars.map((cal: any) => (
                    <tr key={cal.id}>
                      <td style={tdStyle}>
                        {editId === cal.id ? (
                          <input style={{ ...inputStyle, padding: '3px 6px' }} value={editName} onChange={e => setEditName(e.target.value)} />
                        ) : <span style={{ fontWeight: 600 }}>{cal.name}</span>}
                      </td>
                      <td style={tdStyle}>
                        {editId === cal.id ? (
                          <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: '36px', height: '28px', padding: '0', border: 'none', cursor: 'pointer' }} />
                        ) : <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', background: cal.color || '#3b82f6', verticalAlign: 'middle' }} />}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => handleToggleShare(cal)} style={{ background: cal.is_shared ? '#d1fae5' : '#f3f4f6', color: cal.is_shared ? '#065f46' : '#6b7280', border: 'none', borderRadius: '10px', padding: '2px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          {cal.is_shared ? 'Shared' : 'Private'}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        {editId === cal.id ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleEdit(cal.id)}>Save</button>
                            <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => { setEditId(cal.id); setEditName(cal.name); setEditColor(cal.color || '#3b82f6'); }}>Edit</button>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 13. Calendars Management ────────────────────────────────────────────────

function CalendarsManagementModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [tab, setTab] = useState<'calendars' | 'contacts'>('calendars');
  const [calendars, setCalendars] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showCalForm, setShowCalForm] = useState(false);
  const [calName, setCalName] = useState('');
  const [calColor, setCalColor] = useState('#3b82f6');
  const [showConForm, setShowConForm] = useState(false);
  const [conFirst, setConFirst] = useState('');
  const [conLast, setConLast] = useState('');
  const [conEmail, setConEmail] = useState('');
  const [conPhone, setConPhone] = useState('');
  const [conCompany, setConCompany] = useState('');

  const loadCals = async () => {
    const res = await fetch(`${API_BASE}/cpanel/caldav/calendars`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCalendars(await res.json());
  };
  const loadCons = async () => {
    const res = await fetch(`${API_BASE}/cpanel/caldav/contacts`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setContacts(await res.json());
  };

  useEffect(() => { loadCals(); loadCons(); }, []);

  const handleCreateCal = async () => {
    if (!calName) { triggerToast('Calendar name required', 'error'); return; }
    const res = await fetch(`${API_BASE}/cpanel/caldav/calendars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: calName, color: calColor })
    });
    const data = await res.json();
    if (res.ok) { triggerToast('Calendar created'); setCalName(''); setCalColor('#3b82f6'); setShowCalForm(false); loadCals(); }
    else triggerToast(data.error || 'Failed', 'error');
  };

  const handleDeleteCal = async (id: string) => {
    if (!confirm('Delete this calendar?')) return;
    const res = await fetch(`${API_BASE}/cpanel/caldav/calendars/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { triggerToast('Calendar deleted'); loadCals(); }
    else triggerToast('Failed to delete', 'error');
  };

  const handleCreateCon = async () => {
    if (!conFirst) { triggerToast('First name required', 'error'); return; }
    const res = await fetch(`${API_BASE}/cpanel/caldav/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ firstName: conFirst, lastName: conLast, email: conEmail, phone: conPhone, company: conCompany })
    });
    const data = await res.json();
    if (res.ok) {
      triggerToast('Contact created');
      setConFirst(''); setConLast(''); setConEmail(''); setConPhone(''); setConCompany('');
      setShowConForm(false); loadCons();
    } else triggerToast(data.error || 'Failed', 'error');
  };

  const handleDeleteCon = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    const res = await fetch(`${API_BASE}/cpanel/caldav/contacts/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { triggerToast('Contact deleted'); loadCons(); }
    else triggerToast('Failed to delete', 'error');
  };

  const tabBtn = (t: 'calendars' | 'contacts', label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: '7px 20px', fontSize: '13px', fontWeight: tab === t ? 700 : 400, background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--cpanel-orange)' : '2px solid transparent', cursor: 'pointer', color: tab === t ? 'var(--cpanel-orange)' : '#6b7280' }}>
      {label}
    </button>
  );

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '700px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Calendars and Contacts Management</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '0' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e4e7ed', paddingLeft: '16px' }}>
            {tabBtn('calendars', 'Calendars')}
            {tabBtn('contacts', 'Contacts')}
          </div>
          <div style={{ padding: '16px' }}>
            {tab === 'calendars' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setShowCalForm(!showCalForm)}>+ New Calendar</button>
                </div>
                {showCalForm && (
                  <div style={{ background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, ...fgStyle, marginBottom: 0 }}><label style={labelStyle}>Calendar Name</label><input style={inputStyle} value={calName} onChange={e => setCalName(e.target.value)} placeholder="Work Calendar" /></div>
                      <div style={fgStyle}><label style={labelStyle}>Color</label><input type="color" value={calColor} onChange={e => setCalColor(e.target.value)} style={{ width: '44px', height: '34px', padding: '2px', border: '1px solid #ccd0d7', borderRadius: '4px', cursor: 'pointer' }} /></div>
                      <button className="btn-primary" style={{ padding: '7px 14px', fontSize: '12px', marginBottom: '12px' }} onClick={handleCreateCal}>Create</button>
                      <button className="btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', marginBottom: '12px' }} onClick={() => setShowCalForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={tableHead}><th style={thStyle}>Name</th><th style={thStyle}>Color</th><th style={thStyle}>Created</th><th style={thStyle}>Actions</th></tr></thead>
                  <tbody>
                    {calendars.length === 0
                      ? <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No calendars yet.</td></tr>
                      : calendars.map((cal: any) => (
                        <tr key={cal.id}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{cal.name}</td>
                          <td style={tdStyle}><span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', background: cal.color || '#3b82f6', verticalAlign: 'middle' }} /> <span style={{ verticalAlign: 'middle', marginLeft: '6px', fontSize: '11px', color: '#9ca3af' }}>{cal.color}</span></td>
                          <td style={tdStyle}>{new Date(cal.created_at).toLocaleDateString()}</td>
                          <td style={tdStyle}><button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleDeleteCal(cal.id)}>Delete</button></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'contacts' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setShowConForm(!showConForm)}>+ New Contact</button>
                </div>
                {showConForm && (
                  <div style={{ background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={fgStyle}><label style={labelStyle}>First Name *</label><input style={inputStyle} value={conFirst} onChange={e => setConFirst(e.target.value)} placeholder="Jane" /></div>
                      <div style={fgStyle}><label style={labelStyle}>Last Name</label><input style={inputStyle} value={conLast} onChange={e => setConLast(e.target.value)} placeholder="Doe" /></div>
                      <div style={fgStyle}><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={conEmail} onChange={e => setConEmail(e.target.value)} placeholder="jane@example.com" /></div>
                      <div style={fgStyle}><label style={labelStyle}>Phone</label><input style={inputStyle} value={conPhone} onChange={e => setConPhone(e.target.value)} placeholder="+1 555 000 0000" /></div>
                      <div style={{ ...fgStyle, gridColumn: '1/-1' }}><label style={labelStyle}>Company</label><input style={inputStyle} value={conCompany} onChange={e => setConCompany(e.target.value)} placeholder="Acme Corp" /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => setShowConForm(false)}>Cancel</button>
                      <button className="btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={handleCreateCon}>Create</button>
                    </div>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={tableHead}><th style={thStyle}>Name</th><th style={thStyle}>Email</th><th style={thStyle}>Phone</th><th style={thStyle}>Company</th><th style={thStyle}>Actions</th></tr></thead>
                  <tbody>
                    {contacts.length === 0
                      ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No contacts yet.</td></tr>
                      : contacts.map((c: any) => (
                        <tr key={c.id}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{c.first_name} {c.last_name}</td>
                          <td style={tdStyle}>{c.email || '—'}</td>
                          <td style={tdStyle}>{c.phone || '—'}</td>
                          <td style={tdStyle}>{c.company || '—'}</td>
                          <td style={tdStyle}><button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleDeleteCon(c.id)}>Delete</button></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── 14. Email Disk Usage ────────────────────────────────────────────────────

function EmailDiskUsageModal({ token, onClose, triggerToast, pageMode = false }: {
  token: string; onClose: () => void; triggerToast: (m: string, t?: 'success' | 'error') => void; pageMode?: boolean;
}) {
  const [data, setData] = useState<{ accounts: any[]; total_quota_mb: number; total_used_mb: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/cpanel/email/disk-usage`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then((d: any) => {
      setData(d);
      setLoading(false);
    }).catch(() => {
      triggerToast('Failed to load disk usage', 'error');
      setLoading(false);
    });
  }, [token]);

  const UsageBar = ({ used, quota }: { used: number; quota: number }) => {
    const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
    const color = pct > 80 ? '#f97316' : '#22c55e';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>{pct}%</span>
      </div>
    );
  };

  return (
    <div className={pageMode ? 'page-card-wrapper' : 'modal-overlay'}>
      <div className="modal-content" style={pageMode ? { width: '100%' } : { width: '680px', maxWidth: '95%' }}>
        <div className="modal-header">
          <span>Email Disk Usage</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          {loading && <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Loading disk usage...</p>}
          {!loading && data && (
            <div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
                <div style={{ flex: 1, background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total Used</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2d3d' }}>{data.total_used_mb} MB</div>
                </div>
                <div style={{ flex: 1, background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total Quota</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2d3d' }}>{data.total_quota_mb} MB</div>
                </div>
                <div style={{ flex: 2, background: '#f8f9fc', border: '1px solid #e4e7ed', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>Overall Usage</div>
                  <UsageBar used={data.total_used_mb} quota={data.total_quota_mb} />
                </div>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={tableHead}><th style={thStyle}>Email Account</th><th style={thStyle}>Used (MB)</th><th style={thStyle}>Quota (MB)</th><th style={{ ...thStyle, minWidth: '160px' }}>Usage</th></tr></thead>
                  <tbody>
                    {data.accounts.length === 0
                      ? <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>No email accounts found.</td></tr>
                      : data.accounts.map((acc: any, i: number) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{acc.email}</td>
                          <td style={tdStyle}>{acc.used_mb}</td>
                          <td style={tdStyle}>{acc.quota_mb > 0 ? acc.quota_mb : 'Unlimited'}</td>
                          <td style={tdStyle}><UsageBar used={acc.used_mb} quota={acc.quota_mb} /></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
