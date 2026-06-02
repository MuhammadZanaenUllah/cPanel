import { useState, useEffect, useRef } from 'react';
import './App.css';

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
}

interface ForwarderRecord {
  id: string;
  source: string;
  destination: string;
}

// --- Crisp Line Art SVG Icons matching cPanel Jupiter aesthetic ---
const Icons = {
  // Category Icons
  EmailCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  FilesCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  DatabasesCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  DomainsCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  MetricsCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  SecurityCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  AdvancedCategory: () => (
    <svg style={{ width: '18px', height: '18px', color: 'var(--cpanel-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),

  // Tool Icons
  EmailAccounts: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M22 6l-10 7L2 6" />
      <circle cx="17" cy="14" r="3" fill="#ffffff" stroke="#2d3748" strokeWidth="1" />
    </svg>
  ),
  Forwarders: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M10 17l5-5-5-5" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M15 12H3m18-7v14" />
    </svg>
  ),
  EmailRouting: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M4 12h16M14 6l6 6-6 6" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <circle cx="6" cy="12" r="2.5" fill="none" stroke="#2d3748" />
    </svg>
  ),
  Autoresponders: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M3 10h18M3 14h18M7 6l-4 4 4 4" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
    </svg>
  ),
  FileManager: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M3 7v13a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M9 10h6" />
    </svg>
  ),
  Images: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  DiskUsage: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <ellipse cx="12" cy="5" rx="9" ry="3" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  FtpAccounts: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M12 15V3m0 12l-4-4m4 4l4-4M3 21h18" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
    </svg>
  ),
  PhpMyAdmin: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  ),
  Mysql: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Domains: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <circle cx="12" cy="12" r="9" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
    </svg>
  ),
  Redirects: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M17 21l4-4-4-4" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M3 3v10a4 4 0 004 4h14" />
    </svg>
  ),
  Visitors: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  Bandwidth: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <line x1="18" y1="20" x2="18" y2="10" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Terminal: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <polyline points="4 17 10 11 4 5" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Ssl: () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
};

export default function App() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

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

  // File Manager states
  const [currentPath, setCurrentPath] = useState<string>('public_html');
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [editingFile, setEditingFile] = useState<{ name: string; relPath: string; content: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);

  // Terminal states
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Welcome to cPanel Live Web Terminal (v120.0.67)',
    'Type `help` or standard shell commands like `ls`, `pwd`, `whoami`, `uptime` to interact.',
    ''
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalBottomRef = useRef<HTMLDivElement>(null);

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
  const [currentUser, setCurrentUser] = useState<string>('testuser');
  const [loading, setLoading] = useState<boolean>(true);

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal Form states
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const newDocRoot = '/home/testuser/public_html/';
  const [newDb, setNewDb] = useState('');
  const [newFtp, setNewFtp] = useState('');
  const [selectedMailDomain, setSelectedMailDomain] = useState('');

  // Forwarder Form states
  const [fwdSource, setFwdSource] = useState('');
  const [fwdDest, setFwdDest] = useState('');

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

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await fetch(`${API_BASE}/dev-token`);
        if (!res.ok) throw new Error('Failed to fetch development token');
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          setCurrentUser(data.username);
          await fetchAllData(data.token);
        } else {
          triggerToast(data.error || 'No auth token returned', 'error');
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        triggerToast('Backend API is not reachable on port 3000', 'error');
        // Initial setup for safe selection if backend is unreachable
        if (domains.length > 0) {
          setSelectedMailDomain(domains[0].domain);
        }
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

  // Autoscroll terminal
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
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
        setActiveModal(null);
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
        setActiveModal(null);
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
        setActiveModal(null);
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
        setActiveModal('autoresponders'); // Keep modal open
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
        setActiveModal(null);
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
        setActiveModal(null);
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
        setActiveModal(null);
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
        setActiveModal(null);
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
  const handleExecuteTerminalCommand = async () => {
    if (!terminalInput.trim() || !token) return;
    const cmd = terminalInput.trim();
    setTerminalLogs(prev => [...prev, `appem@cpanel-host:~$ ${cmd}`]);
    setTerminalInput('');

    if (cmd === 'clear') {
      setTerminalLogs([]);
      return;
    }
    if (cmd === 'help') {
      setTerminalLogs(prev => [
        ...prev,
        'Allowed safe commands: ls, pwd, whoami, cat, echo, uptime, df, id, mkdir, touch, rm, clear'
      ]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/cpanel/terminal/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      setTerminalLogs(prev => [...prev, data.output, '']);
    } catch (err) {
      setTerminalLogs(prev => [...prev, 'Network error executing command', '']);
    }
  };

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


  return (
    <div className="layout-wrapper">
      {/* 1. PIXEL-PERFECT INDIGO SIDEBAR */}
      <aside className="left-sidebar">
        <div className="logo-section">
          <svg style={{ height: '32px', width: '130px' }} viewBox="0 0 160 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.4 12C9.4 12 7 14.4 7 17.4V22.6C7 25.6 9.4 28 12.4 28H19.6C22.6 28 25 25.6 25 22.6V17.4C25 14.4 22.6 12 19.6 12H12.4Z" fill="#ff6c2c" />
            <path d="M16 16C13.8 16 12 17.8 12 20C12 22.2 13.8 24 16 24C18.2 24 20 22.2 20 20C20 17.8 18.2 16 16 16Z" fill="#ffffff" />
            <text x="34" y="27" fill="#ffffff" fontSize="22" fontWeight="800" fontFamily="-apple-system, sans-serif">cPanel</text>
          </svg>
        </div>
        <div className="sidebar-menu">
          <div className="menu-item active">
            <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
            </svg>
            <span>Tools</span>
          </div>
          <div className="menu-item">
            <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span>Social Media Management</span>
          </div>
          <div className="menu-item">
            <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-4v-4H5V9h4V5h4v4h4v4z" />
            </svg>
            <span>Sitejet Builder</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN VIEWPORT & HEADER */}
      <main className="main-viewport">
        <header className="top-header">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search Tools (/)"
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <svg className="search-icon" style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <div className="header-actions">
            <button className="header-action-btn" title="Notifications">
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <button className="header-action-btn" title="User Profile">
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="page-title-area">
          <h1 className="page-title">Tools</h1>
        </div>

        {/* 3. DASHBOARD MAIN GRID */}
        <div className="dashboard-grid">

          {/* Main sections column */}
          <div className="categories-pane">

            {/* EMAIL CATEGORY */}
            {matchesSearch("Email Accounts Forwarders Email Routing Autoresponders") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('email')}>
                  <div className="category-title">
                    <Icons.EmailCategory />
                    <span>Email</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['email'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['email'] && (
                  <div className="category-body">
                    {matchesSearch("Email Accounts") && (
                      <div className="tool-item" onClick={() => setActiveModal('email')}>
                        <div className="tool-icon-wrapper"><Icons.EmailAccounts /></div>
                        <div className="tool-name">Email Accounts</div>
                      </div>
                    )}
                    {matchesSearch("Forwarders") && (
                      <div className="tool-item" onClick={() => setActiveModal('forwarder')}>
                        <div className="tool-icon-wrapper"><Icons.Forwarders /></div>
                        <div className="tool-name">Forwarders</div>
                      </div>
                    )}
                    {matchesSearch("Email Routing") && (
                      <div className="tool-item" onClick={() => setActiveModal('email_routing')}>
                        <div className="tool-icon-wrapper"><Icons.EmailRouting /></div>
                        <div className="tool-name">Email Routing</div>
                      </div>
                    )}
                    {matchesSearch("Autoresponders") && (
                      <div className="tool-item" onClick={() => setActiveModal('autoresponders')}>
                        <div className="tool-icon-wrapper"><Icons.Autoresponders /></div>
                        <div className="tool-name">Autoresponders</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FILES CATEGORY */}
            {matchesSearch("File Manager Images Disk Usage FTP Accounts") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('files')}>
                  <div className="category-title">
                    <Icons.FilesCategory />
                    <span>Files</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['files'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['files'] && (
                  <div className="category-body">
                    {matchesSearch("File Manager") && (
                      <div className="tool-item" onClick={() => {
                        setActiveModal('filemanager');
                        fetchFiles('public_html');
                      }}>
                        <div className="tool-icon-wrapper"><Icons.FileManager /></div>
                        <div className="tool-name">File Manager</div>
                      </div>
                    )}
                    {matchesSearch("Images") && (
                      <div className="tool-item" onClick={() => setActiveModal('images')}>
                        <div className="tool-icon-wrapper"><Icons.Images /></div>
                        <div className="tool-name">Images</div>
                      </div>
                    )}
                    {matchesSearch("Disk Usage") && (
                      <div className="tool-item" onClick={() => setActiveModal('disk_usage')}>
                        <div className="tool-icon-wrapper"><Icons.DiskUsage /></div>
                        <div className="tool-name">Disk Usage</div>
                      </div>
                    )}
                    {matchesSearch("FTP Accounts") && (
                      <div className="tool-item" onClick={() => setActiveModal('ftp')}>
                        <div className="tool-icon-wrapper"><Icons.FtpAccounts /></div>
                        <div className="tool-name">FTP Accounts</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* DATABASES CATEGORY */}
            {matchesSearch("phpMyAdmin MySQL Databases") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('db_cat')}>
                  <div className="category-title">
                    <Icons.DatabasesCategory />
                    <span>Databases</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['db_cat'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['db_cat'] && (
                  <div className="category-body">
                    {matchesSearch("phpMyAdmin") && (
                      <div className="tool-item" onClick={() => window.open('http://localhost:8080', '_blank')}>
                        <div className="tool-icon-wrapper"><Icons.PhpMyAdmin /></div>
                        <div className="tool-name">phpMyAdmin</div>
                      </div>
                    )}
                    {matchesSearch("MySQL Databases") && (
                      <div className="tool-item" onClick={() => setActiveModal('db')}>
                        <div className="tool-icon-wrapper"><Icons.Mysql /></div>
                        <div className="tool-name">MySQL Databases</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* DOMAINS CATEGORY */}
            {matchesSearch("Domains Redirects DNS Zone Editor") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('domains')}>
                  <div className="category-title">
                    <Icons.DomainsCategory />
                    <span>Domains</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['domains'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['domains'] && (
                  <div className="category-body">
                    {matchesSearch("Domains") && (
                      <div className="tool-item" onClick={() => setActiveModal('domain')}>
                        <div className="tool-icon-wrapper"><Icons.Domains /></div>
                        <div className="tool-name">Domains</div>
                      </div>
                    )}
                    {matchesSearch("Redirects") && (
                      <div className="tool-item" onClick={() => setActiveModal('redirect')}>
                        <div className="tool-icon-wrapper"><Icons.Redirects /></div>
                        <div className="tool-name">Redirects</div>
                      </div>
                    )}
                    {matchesSearch("DNS Zone Editor") && (
                      <div className="tool-item" onClick={() => {
                        const firstDomain = domains[0]?.domain || '';
                        setDnsSelectedDomain(firstDomain);
                        setActiveModal('dns');
                        if (firstDomain) fetchDnsRecords(firstDomain);
                      }}>
                        <div className="tool-icon-wrapper">
                          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
                            <circle cx="12" cy="12" r="9" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
                            <path d="M9 12h6M12 9v6" />
                          </svg>
                        </div>
                        <div className="tool-name">DNS Zone Editor</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* METRICS CATEGORY */}
            {matchesSearch("Visitors Bandwidth") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('metrics')}>
                  <div className="category-title">
                    <Icons.MetricsCategory />
                    <span>Metrics</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['metrics'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['metrics'] && (
                  <div className="category-body">
                    {matchesSearch("Visitors") && (
                      <div className="tool-item" onClick={() => setActiveModal('visitors')}>
                        <div className="tool-icon-wrapper"><Icons.Visitors /></div>
                        <div className="tool-name">Visitors</div>
                      </div>
                    )}
                    {matchesSearch("Bandwidth") && (
                      <div className="tool-item" onClick={() => setActiveModal('bandwidth')}>
                        <div className="tool-icon-wrapper"><Icons.Bandwidth /></div>
                        <div className="tool-name">Bandwidth</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SECURITY CATEGORY */}
            {matchesSearch("SSH Access SSL/TLS") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('security')}>
                  <div className="category-title">
                    <Icons.SecurityCategory />
                    <span>Security</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['security'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['security'] && (
                  <div className="category-body">
                    {matchesSearch("SSH Access") && (
                      <div className="tool-item" onClick={() => {
                        setActiveModal('terminal');
                        setTerminalLogs(['Welcome to cPanel Live Web Terminal (v120.0.67)', 'Type standard shell commands like `ls`, `pwd`, `whoami` to interact.', '']);
                      }}>
                        <div className="tool-icon-wrapper"><Icons.Terminal /></div>
                        <div className="tool-name">SSH Access</div>
                      </div>
                    )}
                    {matchesSearch("SSL/TLS") && (
                      <div className="tool-item" onClick={() => setActiveModal('ssl')}>
                        <div className="tool-icon-wrapper"><Icons.Ssl /></div>
                        <div className="tool-name">SSL/TLS</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ADVANCED CATEGORY */}
            {matchesSearch("Terminal Cron Jobs Backups") && (
              <div className="category-card">
                <div className="category-header" onClick={() => toggleCategory('advanced')}>
                  <div className="category-title">
                    <Icons.AdvancedCategory />
                    <span>Advanced</span>
                  </div>
                  <div className={`category-chevron ${collapsedCategories['advanced'] ? 'collapsed' : ''}`}>
                    <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </div>
                </div>

                {!collapsedCategories['advanced'] && (
                  <div className="category-body">
                    {matchesSearch("Terminal") && (
                      <div className="tool-item" onClick={() => {
                        setActiveModal('terminal');
                        setTerminalLogs(['Welcome to cPanel Live Web Terminal (v120.0.67)', 'Type standard shell commands like `ls`, `pwd`, `whoami` to interact.', '']);
                      }}>
                        <div className="tool-icon-wrapper"><Icons.Terminal /></div>
                        <div className="tool-name">Terminal</div>
                      </div>
                    )}
                    {matchesSearch("Cron Jobs") && (
                      <div className="tool-item" onClick={() => setActiveModal('cron')}>
                        <div className="tool-icon-wrapper">
                          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
                            <circle cx="12" cy="12" r="9" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
                            <path d="M12 7v5l3 3" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
                          </svg>
                        </div>
                        <div className="tool-name">Cron Jobs</div>
                      </div>
                    )}
                    {matchesSearch("Backups") && (
                      <div className="tool-item" onClick={() => setActiveModal('backups')}>
                        <div className="tool-icon-wrapper">
                          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
                            <polyline points="17 8 12 3 7 8" stroke="var(--cpanel-orange)" strokeWidth="1.5" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <div className="tool-name">Backups</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR INFORMATION & STATS */}
          <div className="info-sidebar">

            {/* General Info */}
            <div className="sidebar-widget">
              <div className="widget-title">General Information</div>
              <div className="widget-body">
                <div className="info-row">
                  <span className="info-label">Current User</span>
                  <span className="info-val">{currentUser}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Primary Domain</span>
                  <span className="info-val">
                    <a href={`https://${primaryDomainName}`} target="_blank" rel="noreferrer" className="info-link">
                      {primaryDomainName}
                    </a>
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Shared IP Address</span>
                  <span className="info-val">{serverIp}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Home Directory</span>
                  <span className="info-val">/home/{currentUser}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Last Login IP Address</span>
                  <span className="info-val">{lastLoginIp}</span>
                </div>
                {/* <div className="info-row">
                  <span className="info-label">Theme</span>
                  <span className="info-val">
                    <select className="theme-select" defaultValue="jupiter">
                      <option value="jupiter">jupiter</option>
                    </select>
                  </span>
                </div> */}
              </div>
              <button className="server-info-btn">
                <span>Server Information</span>
                <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Statistics */}
            <div className="sidebar-widget">
              <div className="widget-title">Statistics</div>
              <div className="widget-body">
                <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="info-label">Alias Domains</span>
                    <span className="info-val">0 / 3</span>
                  </div>
                  <div className="stat-bar-container"><div className="stat-bar-fill" style={{ width: '0%' }}></div></div>
                </div>
                <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="info-label">Addon Domains</span>
                    <span className="info-val">{domains.length > 0 ? domains.length - 1 : 0} / 3</span>
                  </div>
                  <div className="stat-bar-container"><div className="stat-bar-fill" style={{ width: `${((domains.length > 0 ? domains.length - 1 : 0) / 3) * 100}%` }}></div></div>
                </div>
                <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="info-label">Disk Usage</span>
                    <span className="info-val">5.91 GB / ∞</span>
                  </div>
                  <div className="stat-bar-container"><div className="stat-bar-fill" style={{ width: '12%' }}></div></div>
                </div>
                <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="info-label">Bandwidth</span>
                    <span className="info-val">250.66 MB / ∞</span>
                  </div>
                  <div className="stat-bar-container"><div className="stat-bar-fill" style={{ width: '4%' }}></div></div>
                </div>
                <div className="info-row">
                  <span className="info-label">Email Accounts</span>
                  <span className="info-val">{emails.length} / ∞</span>
                </div>
                <div className="info-row">
                  <span className="info-label">MySQL Databases</span>
                  <span className="info-val">{databases.length} / ∞</span>
                </div>
                <div className="info-row">
                  <span className="info-label">FTP Accounts</span>
                  <span className="info-val">{ftpAccounts.length} / ∞</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* 4. FOOTER */}
        <footer className="footer-section">
          <div className="footer-left">
            <svg style={{ height: '18px', width: '70px' }} viewBox="0 0 160 40" fill="none">
              <path d="M12.4 12C9.4 12 7 14.4 7 17.4V22.6C7 25.6 9.4 28 12.4 28H19.6C22.6 28 25 25.6 25 22.6V17.4C25 14.4 22.6 12 19.6 12H12.4Z" fill="#ff6c2c" />
              <path d="M16 16C13.8 16 12 17.8 12 20C12 22.2 13.8 24 16 24C18.2 24 20 22.2 20 20C20 17.8 18.2 16 16 16Z" fill="#1a2b4c" />
              <text x="34" y="27" fill="#1a2b4c" fontSize="22" fontWeight="800">cPanel</text>
            </svg>
            <span style={{ fontSize: '11px', marginLeft: '6px' }}>120.0.67</span>
          </div>
          <div className="footer-right">
            <a href="#home" className="footer-link">Home</a>
            <a href="#trademarks" className="footer-link">Trademarks</a>
            <a href="#privacy" className="footer-link">Privacy Policy</a>
            <a href="#docs" className="footer-link">Documentation</a>
            <a href="#feedback" className="footer-link">Give Feedback</a>
          </div>
        </footer>
      </main>

      {/* --- LIVE INTERACTIVE FILE MANAGER MODAL --- */}
      {activeModal === 'filemanager' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>File Manager - /home/{currentUser}/{currentPath}</span>
              <button className="close-btn" onClick={() => {
                setActiveModal(null);
                setEditingFile(null);
              }}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => {
                  const parts = currentPath.split('/');
                  parts.pop();
                  fetchFiles(parts.join('/'));
                }} disabled={!currentPath || currentPath === 'public_html'}>
                  📁 Up One Level
                </button>
                <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setShowNewFileDialog(true)}>
                  📄 + New File
                </button>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setShowNewFolderDialog(true)}>
                  📁 + New Folder
                </button>
              </div>

              {showNewFileDialog && (
                <div style={{ background: '#f5f7fa', padding: '10px', borderRadius: '3px', border: '1px solid #dcdfe6', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="text" placeholder="filename.html" className="text-input" value={newFileName} onChange={e => setNewFileName(e.target.value)} style={{ padding: '4px' }} />
                  <button className="btn-primary" style={{ padding: '4px 10px' }} onClick={() => handleFileActionCreate(newFileName, false)}>Create</button>
                  <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setShowNewFileDialog(false)}>Cancel</button>
                </div>
              )}

              {showNewFolderDialog && (
                <div style={{ background: '#f5f7fa', padding: '10px', borderRadius: '3px', border: '1px solid #dcdfe6', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="text" placeholder="images" className="text-input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} style={{ padding: '4px' }} />
                  <button className="btn-primary" style={{ padding: '4px 10px' }} onClick={() => handleFileActionCreate(newFolderName, true)}>Create</button>
                  <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setShowNewFolderDialog(false)}>Cancel</button>
                </div>
              )}

              {editingFile ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>Editing: {editingFile.name}</strong>
                    <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditingFile(null)}>Cancel</button>
                  </div>
                  <textarea
                    style={{ width: '100%', height: '280px', fontFamily: 'monospace', padding: '10px', border: '1px solid #ccd0d7', borderRadius: '3px', outline: 'none' }}
                    value={editingFile.content}
                    onChange={e => setEditingFile({ ...editingFile, content: e.target.value })}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button className="btn-secondary" onClick={() => setEditingFile(null)}>Close</button>
                    <button className="btn-primary" onClick={handleFileActionSave}>Save File</button>
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Name</th>
                      <th style={{ padding: '8px' }}>Type</th>
                      <th style={{ padding: '8px' }}>Size</th>
                      <th style={{ padding: '8px' }}>Last Modified</th>
                      <th style={{ padding: '8px', width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filesList.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>This directory is empty</td>
                      </tr>
                    ) : (
                      filesList.map(item => (
                        <tr key={item.name} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>
                            {item.isDirectory ? (
                              <span style={{ cursor: 'pointer', color: 'var(--text-blue)' }} onClick={() => fetchFiles(item.relPath)}>
                                📁 {item.name}
                              </span>
                            ) : (
                              <span>📄 {item.name}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{item.isDirectory ? 'Folder' : 'File'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{item.isDirectory ? '-' : `${(item.size / 1024).toFixed(2)} KB`}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{new Date(item.updatedAt).toLocaleDateString()}</td>
                          <td style={{ padding: '8px', display: 'flex', gap: '6px' }}>
                            {!item.isDirectory && (
                              <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => {
                                try {
                                  setEditingFile({ name: item.name, relPath: item.relPath, content: '/* Add your file content here */' });
                                } catch (e) {
                                  triggerToast('Failed to open file', 'error');
                                }
                              }}>
                                Edit
                              </button>
                            )}
                            <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }} onClick={() => handleFileActionDelete(item.relPath)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setActiveModal(null);
                setEditingFile(null);
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE SSH TERMINAL MODAL --- */}
      {activeModal === 'terminal' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '700px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>cPanel SSH Live Terminal emulator</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ background: '#080a0e', padding: '16px' }}>

              <div style={{ height: '300px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', color: '#00ff66', display: 'flex', flexDirection: 'column', gap: '4px', whiteSpace: 'pre-wrap' }}>
                {terminalLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
                <div ref={terminalBottomRef} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '10px' }}>
                <span style={{ fontFamily: 'monospace', color: '#00ff66', fontSize: '12px', fontWeight: 'bold' }}>
                  appem@cpanel-host:~$
                </span>
                <input
                  type="text"
                  style={{ background: 'none', border: 'none', color: '#ffffff', fontFamily: 'monospace', fontSize: '12px', outline: 'none', flex: 1 }}
                  value={terminalInput}
                  onChange={e => setTerminalInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleExecuteTerminalCommand();
                  }}
                  autoFocus
                  placeholder="type ls, pwd, uptime..."
                />
                <button className="btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={handleExecuteTerminalCommand}>
                  Send
                </button>
              </div>

            </div>
            <div className="modal-footer" style={{ background: '#0a0d14', borderTopColor: 'rgba(255,255,255,0.05)' }}>
              <button className="btn-secondary" style={{ color: '#ffffff', borderColor: '#454d5e', background: 'none' }} onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE SSL MANAGER MODAL --- */}
      {activeModal === 'ssl' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>SSL/TLS Manager - AutoSSL Certificate Provisioning</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '12px' }}>
                Automate your Let's Encrypt SSL/TLS certificates challenge on Nginx virtual hosting blocks.
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Domain</th>
                    <th style={{ padding: '8px' }}>SSL Issuer</th>
                    <th style={{ padding: '8px' }}>Expiration</th>
                    <th style={{ padding: '8px', width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No domains registered.</td>
                    </tr>
                  ) : (
                    domains.map(d => {
                      const sslInfo = sslStatusList.find(s => s.domain === d.domain);
                      return (
                        <tr key={d.domain} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>🔒 {d.domain}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                            {sslInfo?.issuer || 'Self-Signed (Untrusted)'}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                            {sslInfo?.expires_at ? new Date(sslInfo.expires_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <button className="btn-primary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => handleIssueSSL(d.domain)}>
                              AutoSSL
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE EMAIL FORWARDERS MODAL --- */}
      {activeModal === 'forwarder' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Mailing Forwarders Manager</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Active Email Forwarders</h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Source Address</th>
                    <th style={{ padding: '8px' }}>Forward To</th>
                    <th style={{ padding: '8px', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forwarders.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No forwarders configured.</td>
                    </tr>
                  ) : (
                    forwarders.map(f => (
                      <tr key={f.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>✉️ {f.source}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>➡️ {f.destination}</td>
                        <td style={{ padding: '8px' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }}
                            onClick={async () => {
                              if (!confirm('Delete this forwarder?') || !token) return;
                              try {
                                const res = await fetch(`${API_BASE}/cpanel/mail/forwarders/${f.id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  triggerToast('Forwarder deleted successfully');
                                  await fetchAllData(token);
                                }
                              } catch (e) {
                                triggerToast('Error deleting forwarder', 'error');
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', borderTop: '1px solid #e4e7ed', paddingTop: '12px' }}>Add a New Forwarder</h3>

              <div className="form-group">
                <label className="form-label">Address to Forward</label>
                <div className="form-input-container">
                  <input
                    type="text"
                    placeholder="e.g. contact"
                    value={fwdSource}
                    onChange={e => setFwdSource(e.target.value)}
                    className="text-input"
                  />
                  <select
                    className="theme-select"
                    value={selectedMailDomain}
                    onChange={e => setSelectedMailDomain(e.target.value)}
                    style={{ padding: '6px' }}
                  >
                    {domains.map(d => (
                      <option key={d.domain} value={d.domain}>@{d.domain}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Destination Address</label>
                <input
                  type="text"
                  placeholder="e.g. mybackup@gmail.com"
                  value={fwdDest}
                  onChange={e => setFwdDest(e.target.value)}
                  className="text-input"
                />
              </div>

              <button className="btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleCreateForwarder}>
                Add Forwarder
              </button>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE DOMAIN REDIRECTS MODAL --- */}
      {activeModal === 'redirect' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '650px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Redirects Manager</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Active Redirects</h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Domain Address</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px' }}>Redirect To</th>
                    <th style={{ padding: '8px', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {redirects.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No redirect configurations found.</td>
                    </tr>
                  ) : (
                    redirects.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>🔗 {r.domain}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{r.redirect_type} Permanent</td>
                        <td style={{ padding: '8px', color: 'var(--text-blue)', wordBreak: 'break-all' }}>
                          <a href={r.redirect_url} target="_blank" rel="noreferrer">{r.redirect_url}</a>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }}
                            onClick={() => handleDeleteRedirect(r.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', borderTop: '1px solid #e4e7ed', paddingTop: '12px' }}>Add a New Redirect</h3>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="theme-select" value={redirectType} onChange={e => setRedirectType(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                  <option value="301">Permanent (301)</option>
                  <option value="302">Temporary (302)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label className="form-label">Domain to Redirect</label>
                <select className="theme-select" value={redirectDomain} onChange={e => setRedirectDomain(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                  {domains.map(d => (
                    <option key={d.domain} value={d.domain}>{d.domain}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label className="form-label">Redirects To (Destination URL)</label>
                <input
                  type="text"
                  placeholder="https://newbrand.com/"
                  value={redirectUrl}
                  onChange={e => setRedirectUrl(e.target.value)}
                  className="text-input"
                />
              </div>

              <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleCreateRedirect}>
                Add Redirect Rule
              </button>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE IMAGES TOOLS MODAL --- */}
      {activeModal === 'images' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '650px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Images Management Tools</span>
              <button className="close-btn" onClick={() => {
                setActiveModal(null);
                setSelectedImage(null);
              }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '12px' }}>
                Use cPanel's graphic tools to rescale, convert, or generate thumbnails inside your `/home/{currentUser}/public_html` workspace.
              </p>

              {!selectedImage ? (
                <>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Available Images in public_html</h3>

                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e4e7ed', borderRadius: '3px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                          <th style={{ padding: '8px' }}>Filename</th>
                          <th style={{ padding: '8px' }}>Size</th>
                          <th style={{ padding: '8px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workspaceImages.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No image files (.png, .jpg, .svg) found in `public_html`.
                            </td>
                          </tr>
                        ) : (
                          workspaceImages.map(img => (
                            <tr key={img.relPath} style={{ borderBottom: '1px solid #f0f2f5' }}>
                              <td style={{ padding: '8px', fontWeight: '500' }}>🖼️ {img.name}</td>
                              <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{(img.sizeBytes / 1024).toFixed(2)} KB</td>
                              <td style={{ padding: '8px' }}>
                                <button className="btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setSelectedImage(img)}>
                                  Scale Image
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '14px' }}>Rescaling Image: {selectedImage.name}</h3>

                  <div style={{ background: '#f5f7fa', padding: '12px', border: '1px solid #dcdfe6', borderRadius: '3px', marginBottom: '14px', fontSize: '12px' }}>
                    <strong>Relative Path:</strong> public_html/{selectedImage.relPath}<br />
                    <strong>Original Size:</strong> {(selectedImage.sizeBytes / 1024).toFixed(2)} KB
                  </div>

                  <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Target Width (Pixels)</label>
                      <input type="number" className="text-input" value={scaleWidth} onChange={e => setScaleWidth(Number(e.target.value) || 100)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Target Height (Pixels)</label>
                      <input type="number" className="text-input" value={scaleHeight} onChange={e => setScaleHeight(Number(e.target.value) || 100)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn-secondary" onClick={() => setSelectedImage(null)}>Back to List</button>
                    <button className="btn-primary" onClick={handleResizeImage}>Rescale and Save Copy</button>
                  </div>
                </div>
              )}

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setActiveModal(null);
                setSelectedImage(null);
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE DISK USAGE MODAL --- */}
      {activeModal === 'disk_usage' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Disk Space Consumption Explorer</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '12px' }}>
                Breakdown of actual storage usage across all directories and database instances inside `/home/{currentUser}/` hosting bounds.
              </p>

              <div style={{ background: '#f8f9fc', border: '1px solid #e4e7ed', padding: '14px', borderRadius: '4px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Total Storage Used:</span>
                <span style={{ color: 'var(--cpanel-orange)', fontWeight: 'bold', fontSize: '16px' }}>
                  {(diskUsage.totalBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {diskUsage.breakdown?.map(item => {
                  const percentage = diskUsage.totalBytes > 0 ? (item.bytes / diskUsage.totalBytes) * 100 : 0;
                  return (
                    <div key={item.name} style={{ fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: '500' }}>
                        <span>📁 {item.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {(item.bytes / (1024 * 1024)).toFixed(2)} MB ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="stat-bar-container" style={{ height: '8px', background: '#e4e7ed', borderRadius: '4px' }}>
                        <div className="stat-bar-fill" style={{ width: `${percentage}%`, height: '100%', background: 'var(--cpanel-orange)', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE VISITORS LOGS MODAL --- */}
      {activeModal === 'visitors' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '750px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Domain Access Logs (Live Visitors)</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '12px' }}>
                Displays the latest HTTP requests hitting virtual host block configurations for `{primaryDomainName}` in real-time.
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Client IP</th>
                    <th style={{ padding: '6px' }}>Timestamp</th>
                    <th style={{ padding: '6px' }}>Method</th>
                    <th style={{ padding: '6px' }}>Request Path</th>
                    <th style={{ padding: '6px' }}>Status</th>
                    <th style={{ padding: '6px' }}>Response Size</th>
                    <th style={{ padding: '6px' }}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No access logs found.</td>
                    </tr>
                  ) : (
                    visitors.map((v, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '6px', fontWeight: '500', color: '#1a2b4c' }}>👤 {v.ip}</td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{new Date(v.time).toLocaleTimeString()}</td>
                        <td style={{ padding: '6px' }}><span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '9px', background: v.method === 'POST' ? '#e3f2fd' : '#e8f5e9', color: v.method === 'POST' ? '#1565c0' : '#2e7d32', fontWeight: 'bold' }}>{v.method}</span></td>
                        <td style={{ padding: '6px', fontWeight: '500', color: '#333' }}>{v.path}</td>
                        <td style={{ padding: '6px' }}><span style={{ color: v.status >= 400 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }}>{v.status}</span></td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{v.size > 0 ? `${(v.size / 1024).toFixed(1)} KB` : '-'}</td>
                        <td style={{ padding: '6px', color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.ua}>{v.ua}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE BANDWIDTH STATISTICS MODAL --- */}
      {activeModal === 'bandwidth' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '650px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Bandwidth Utilization Analyzer</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '12px' }}>
                Shows bandwidth consumption history for your domains over the current fiscal year.
              </p>

              <div style={{ border: '1px solid #e4e7ed', borderRadius: '4px', padding: '16px', background: '#f8f9fc', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>Interactive Bandwidth Trend Chart</h4>

                {/* SVG Area Bar Chart */}
                <div style={{ display: 'flex', gap: '8px', height: '150px', alignItems: 'flex-end', borderBottom: '2px solid #ccd0d7', paddingBottom: '4px' }}>
                  {bandwidth.map((item, idx) => {
                    const total = item.http + item.ftp + item.mail;
                    const maxBw = 200; // scaling cap
                    const heightPercent = Math.min((total / maxBw) * 100, 100);
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${heightPercent}%`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                          <div style={{ background: '#ff6c2c', flex: item.http }} title={`HTTP: ${item.http} MB`}></div>
                          <div style={{ background: '#2f80ed', flex: item.ftp }} title={`FTP: ${item.ftp} MB`}></div>
                          <div style={{ background: '#27ae60', flex: item.mail }} title={`Mail: ${item.mail} MB`}></div>
                        </div>
                        <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap', height: '12px' }}>
                          {item.month.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend and stats */}
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '12px', borderTop: '1px solid #e4e7ed', paddingTop: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ff6c2c', borderRadius: '2px' }}></span> HTTP Traffic
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#2f80ed', borderRadius: '2px' }}></span> FTP Uploads
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#27ae60', borderRadius: '2px' }}></span> SMTP/Mail Protocol
                </span>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE EMAIL ROUTING MODAL --- */}
      {activeModal === 'email_routing' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Email Routing Manager</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '12px' }}>
                Choose how incoming mail for a domain should be routed.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>Select Domain</label>
                <select
                  className="theme-select"
                  value={selectedRoutingDomain}
                  onChange={e => {
                    const dom = e.target.value;
                    setSelectedRoutingDomain(dom);
                    const existing = emailRoutings.find(r => r.domain === dom);
                    setSelectedRoutingType(existing?.routing_type || 'local');
                  }}
                  style={{ width: '100%', padding: '8px' }}
                >
                  {domains.map(d => (
                    <option key={d.domain} value={d.domain}>{d.domain}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Routing Configuration</label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="routing_type"
                      value="local"
                      checked={selectedRoutingType === 'local'}
                      onChange={e => setSelectedRoutingType(e.target.value)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong>Local Mail Exchanger</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                        This server will receive mail for this domain. Mail will be delivered to the local mailboxes.
                      </span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="routing_type"
                      value="backup"
                      checked={selectedRoutingType === 'backup'}
                      onChange={e => setSelectedRoutingType(e.target.value)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong>Backup Mail Exchanger</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                        This server will act as a backup mail exchanger. Mail will be held until the primary mail exchanger is available.
                      </span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="routing_type"
                      value="remote"
                      checked={selectedRoutingType === 'remote'}
                      onChange={e => setSelectedRoutingType(e.target.value)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong>Remote Mail Exchanger</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                        This server will not receive mail for this domain. Mail will be delivered to the remote MX records.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={handleUpdateEmailRouting}>
                Change Routing Setting
              </button>

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE INTERACTIVE AUTORESPONDERS MODAL --- */}
      {activeModal === 'autoresponders' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '650px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Autoresponders Manager</span>
              <button className="close-btn" onClick={() => {
                setActiveModal(null);
                setEditingAutoresponder(null);
              }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>

              {!editingAutoresponder ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold' }}>Current Autoresponders</h3>
                    <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setEditingAutoresponder({ isNew: true })}>
                      + Add Autoresponder
                    </button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Email Address</th>
                        <th style={{ padding: '8px' }}>Subject</th>
                        <th style={{ padding: '8px' }}>Interval (Hours)</th>
                        <th style={{ padding: '8px', width: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoresponders.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No autoresponders configured.</td>
                        </tr>
                      ) : (
                        autoresponders.map(a => (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                            <td style={{ padding: '8px', fontWeight: '500' }}>🤖 {a.email}</td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{a.subject}</td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{a.interval_hours}h</td>
                            <td style={{ padding: '8px', display: 'flex', gap: '6px' }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                                onClick={() => {
                                  const [local, domain] = a.email.split('@');
                                  setAutoEmailLocal(local);
                                  setSelectedMailDomain(domain);
                                  setAutoFromName(a.from_name);
                                  setAutoSubject(a.subject);
                                  setAutoBody(a.body);
                                  setAutoInterval(a.interval_hours);
                                  setEditingAutoresponder(a);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }}
                                onClick={() => handleDeleteAutoresponder(a.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              ) : (
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '14px' }}>
                    {editingAutoresponder.isNew ? 'Create New Autoresponder' : `Modify Autoresponder: ${editingAutoresponder.email}`}
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    {editingAutoresponder.isNew ? (
                      <div className="form-input-container">
                        <input
                          type="text"
                          placeholder="e.g. support"
                          value={autoEmailLocal}
                          onChange={e => setAutoEmailLocal(e.target.value)}
                          className="text-input"
                        />
                        <select
                          className="theme-select"
                          value={selectedMailDomain}
                          onChange={e => setSelectedMailDomain(e.target.value)}
                          style={{ padding: '6px' }}
                        >
                          {domains.map(d => (
                            <option key={d.domain} value={d.domain}>@{d.domain}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editingAutoresponder.email}
                        readOnly
                        className="text-input"
                        style={{ backgroundColor: '#f5f7fa', color: 'var(--text-muted)' }}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">From Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Customer Support"
                      value={autoFromName}
                      onChange={e => setAutoFromName(e.target.value)}
                      className="text-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input
                      type="text"
                      placeholder="e.g. Thank you for your email"
                      value={autoSubject}
                      onChange={e => setAutoSubject(e.target.value)}
                      className="text-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Body</label>
                    <textarea
                      placeholder="Enter the automated response body here..."
                      value={autoBody}
                      onChange={e => setAutoBody(e.target.value)}
                      className="text-input"
                      style={{ height: '100px', padding: '8px', fontFamily: 'sans-serif' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Interval (Hours)</label>
                    <input
                      type="number"
                      min="1"
                      value={autoInterval}
                      onChange={e => setAutoInterval(Number(e.target.value) || 1)}
                      className="text-input"
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      The number of hours to wait before sending another autoresponse to the same sender email address.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                    <button className="btn-secondary" onClick={() => {
                      setEditingAutoresponder(null);
                      setAutoEmailLocal('');
                      setAutoFromName('');
                      setAutoSubject('');
                      setAutoBody('');
                      setAutoInterval(1);
                    }}>Cancel</button>
                    <button className="btn-primary" onClick={handleCreateOrUpdateAutoresponder}>
                      Save Config
                    </button>
                  </div>
                </div>
              )}

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setActiveModal(null);
                setEditingAutoresponder(null);
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- EMAIL MODAL --- */}
      {activeModal === 'email' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Create an Email Account</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="form-input-container">
                  <input
                    type="text"
                    placeholder="e.g. contact"
                    value={newUser}
                    onChange={e => setNewUser(e.target.value)}
                    className="text-input"
                  />

                  {/* Real Dynamic Dropdown selector populated from live SQL domains */}
                  <select
                    className="theme-select"
                    value={selectedMailDomain}
                    onChange={e => setSelectedMailDomain(e.target.value)}
                    style={{ padding: '6px' }}
                  >
                    {domains.map(d => (
                      <option key={d.domain} value={d.domain}>@{d.domain}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="******"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="text-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateEmail}>Create Account</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DOMAIN MODAL --- */}
      {activeModal === 'domain' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Create an Addon Domain</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Domain Name</label>
                <input
                  type="text"
                  placeholder="e.g. newbrand.com"
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  className="text-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Document Root</label>
                <input
                  type="text"
                  value={newDocRoot + (newDomain || '')}
                  readOnly
                  className="text-input"
                  style={{ backgroundColor: '#f5f7fa', color: 'var(--text-muted)' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateDomain}>Add Domain</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DATABASE & USERS MODAL --- */}
      {activeModal === 'db' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '700px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>MySQL Databases &amp; Users</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>

              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Databases</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Database Name</th>
                    <th style={{ padding: '8px', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {databases.length === 0 ? (
                    <tr><td colSpan={2} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No databases yet.</td></tr>
                  ) : (
                    databases.map(db => (
                      <tr key={db} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>🗄️ {db}</td>
                        <td style={{ padding: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }} onClick={() => handleDeleteMysqlDb(db)}>Drop</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">New Database</label>
                  <div className="form-input-container">
                    <span className="domain-suffix" style={{ marginRight: '4px', fontWeight: 'bold' }}>{currentUser}_</span>
                    <input type="text" placeholder="e.g. blog" value={newDb} onChange={e => setNewDb(e.target.value)} className="text-input" />
                  </div>
                </div>
                <button className="btn-primary" style={{ padding: '7px 14px' }} onClick={handleCreateDatabase}>Create DB</button>
              </div>

              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', borderTop: '1px solid #e4e7ed', paddingTop: '12px' }}>MySQL Users</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Username</th>
                  </tr>
                </thead>
                <tbody>
                  {mysqlUsers.length === 0 ? (
                    <tr><td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No MySQL users yet.</td></tr>
                  ) : (
                    mysqlUsers.map(u => (
                      <tr key={u} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>👤 {u}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>{currentUser}_username</label>
                  <input type="text" className="text-input" placeholder="username" value={newMysqlUser} onChange={e => setNewMysqlUser(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Password</label>
                  <input type="password" className="text-input" placeholder="******" value={newMysqlUserPass} onChange={e => setNewMysqlUserPass(e.target.value)} />
                </div>
                <button className="btn-secondary" style={{ padding: '7px 14px' }} onClick={handleCreateMysqlUser}>Create User</button>
              </div>

              {mysqlUsers.length > 0 && databases.length > 0 && (
                <>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', borderTop: '1px solid #e4e7ed', paddingTop: '12px' }}>Assign User to Database</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Database</label>
                      <select className="theme-select" value={assignDb} onChange={e => setAssignDb(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                        <option value="">— select —</option>
                        {databases.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>User</label>
                      <select className="theme-select" value={assignUser} onChange={e => setAssignUser(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                        <option value="">— select —</option>
                        {mysqlUsers.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <button className="btn-primary" style={{ padding: '7px 14px' }} onClick={handleAssignDbUser}>Grant ALL</button>
                  </div>
                </>
              )}

            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- FTP MODAL --- */}
      {activeModal === 'ftp' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Add FTP Account</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">FTP Login</label>
                <div className="form-input-container">
                  <input
                    type="text"
                    placeholder="e.g. deploy"
                    value={newFtp}
                    onChange={e => setNewFtp(e.target.value)}
                    className="text-input"
                  />
                  <select
                    className="theme-select"
                    value={selectedMailDomain}
                    onChange={e => setSelectedMailDomain(e.target.value)}
                    style={{ padding: '6px' }}
                  >
                    {domains.map(d => (
                      <option key={d.domain} value={d.domain}>@{d.domain}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="******"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="text-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateFtp}>Add FTP Account</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DNS ZONE EDITOR MODAL --- */}
      {activeModal === 'dns' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '820px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>DNS Zone Editor</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <div style={{ marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Zone:</label>
                <select className="theme-select" value={dnsSelectedDomain} onChange={e => { setDnsSelectedDomain(e.target.value); fetchDnsRecords(e.target.value); }} style={{ padding: '6px' }}>
                  {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                </select>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Name</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px' }}>Content</th>
                    <th style={{ padding: '8px' }}>TTL</th>
                    <th style={{ padding: '8px', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dnsRecords.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No DNS records found for this zone.</td></tr>
                  ) : (
                    dnsRecords.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{r.name}</td>
                        <td style={{ padding: '8px' }}><span style={{ padding: '2px 6px', borderRadius: '3px', background: '#e3f2fd', color: '#1565c0', fontSize: '10px', fontWeight: 'bold' }}>{r.type}</span></td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{r.ttl}s</td>
                        <td style={{ padding: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }} onClick={() => handleDeleteDnsRecord(r.id)}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', borderTop: '1px solid #e4e7ed', paddingTop: '12px' }}>Add DNS Record</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Name</label>
                  <input type="text" className="text-input" placeholder={dnsSelectedDomain} value={dnsNewName} onChange={e => setDnsNewName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Type</label>
                  <select className="theme-select" value={dnsNewType} onChange={e => setDnsNewType(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                    {['A','AAAA','CNAME','MX','TXT','NS','SRV','CAA'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Content</label>
                  <input type="text" className="text-input" placeholder="e.g. 203.0.113.5" value={dnsNewContent} onChange={e => setDnsNewContent(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>TTL</label>
                  <input type="number" className="text-input" value={dnsNewTtl} onChange={e => setDnsNewTtl(Number(e.target.value))} />
                </div>
              </div>
              {(dnsNewType === 'MX' || dnsNewType === 'SRV') && (
                <div style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Priority</label>
                  <input type="number" className="text-input" style={{ width: '120px' }} value={dnsNewPriority} onChange={e => setDnsNewPriority(Number(e.target.value))} />
                </div>
              )}
              <button className="btn-primary" style={{ marginTop: '8px' }} onClick={handleAddDnsRecord}>Add Record</button>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CRON JOBS MODAL --- */}
      {activeModal === 'cron' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '780px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Cron Jobs Manager</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Schedule (min hr day mo wd)</th>
                    <th style={{ padding: '8px' }}>Command</th>
                    <th style={{ padding: '8px', width: '70px' }}>Status</th>
                    <th style={{ padding: '8px', width: '70px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cronJobs.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No cron jobs configured.</td></tr>
                  ) : (
                    cronJobs.map((job: any) => (
                      <tr key={job.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                          {job.minute} {job.hour} {job.day} {job.month} {job.weekday}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.command}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ color: job.enabled ? '#67c23a' : '#f56c6c', fontWeight: 'bold', fontSize: '11px' }}>
                            {job.enabled ? 'Active' : 'Off'}
                          </span>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }} onClick={() => handleDeleteCron(job.id)}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', borderTop: '1px solid #e4e7ed', paddingTop: '12px' }}>Add New Cron Job</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '10px' }}>
                {([['Minute', cronMinute, setCronMinute], ['Hour', cronHour, setCronHour], ['Day', cronDay, setCronDay], ['Month', cronMonth, setCronMonth], ['Weekday', cronWeekday, setCronWeekday]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="form-label" style={{ fontSize: '11px' }}>{label}</label>
                    <input type="text" className="text-input" value={val} onChange={e => setter(e.target.value)} placeholder="*" />
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Command</label>
                <input type="text" className="text-input" placeholder="e.g. /usr/bin/php /home/user/cron.php" value={cronCommand} onChange={e => setCronCommand(e.target.value)} />
              </div>
              <button className="btn-primary" style={{ marginTop: '8px' }} onClick={handleCreateCron}>Add Cron Job</button>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- BACKUPS MODAL --- */}
      {activeModal === 'backups' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '720px', maxWidth: '95%' }}>
            <div className="modal-header">
              <span>Backup Manager</span>
              <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>Full account backups — home directory and all MySQL databases.</p>
                <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={handleCreateBackup}>Generate Backup</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '2px solid #e4e7ed', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Backup Name</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px' }}>Size</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Created</th>
                    <th style={{ padding: '8px', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No backups yet. Click "Generate Backup" to start.</td></tr>
                  ) : (
                    backups.map((b: any) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td style={{ padding: '8px', fontWeight: '500', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💾 {b.name}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{b.type}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{b.size_bytes > 0 ? `${(b.size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ color: b.status === 'completed' ? '#67c23a' : b.status === 'failed' ? '#f56c6c' : '#e6a23c', fontWeight: 'bold', fontSize: '11px' }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px', color: '#f56c6c' }} onClick={() => handleDeleteBackup(b.id)}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DYNAMIC ACTION NOTIFICATION TOAST --- */}
      {toast && (
        <div className={`toast-alert ${toast.type === 'error' ? 'error' : ''}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

    </div>
  );
}
