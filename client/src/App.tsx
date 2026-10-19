import { useCallback, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Filter, LayoutDashboard, LogOut, Menu, MessageCircle, Plus, Search, Settings2, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { api, getAccessToken, login, logout, refreshSession, setAccessToken, signup } from './api';
import type { ActivityEvent, Referral, ReferralStatus, SessionUser } from './types';
import ActivityFeed from './components/ActivityFeed';
import StatusBadge from './components/StatusBadge';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const displayName = (referral: Referral) => typeof referral.createdBy === 'string' ? 'You' : referral.createdBy.name;

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | ReferralStatus>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [referralData, activityData] = await Promise.all([
        api<{ referrals: Referral[] }>('/referrals?limit=100'),
        api<{ events: ActivityEvent[] }>('/referrals/activity?limit=100')
      ]);
      setReferrals(referralData.referrals); setEvents(activityData.events);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your workspace'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let mounted = true;
    void refreshSession().then(async (ok) => {
      if (!ok || !mounted) { setBooting(false); return; }
      try { const data = await api<{ user: SessionUser }>('/auth/me', {}, false); if (mounted) setUser(data.user); }
      catch { setAccessToken(null); }
      finally { if (mounted) setBooting(false); }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (user) void loadData(); }, [user, loadData]);

  useEffect(() => {
    const token = getAccessToken(); if (!user || !token) return;
    const connection = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    connection.on('activity:new', (event: ActivityEvent) => setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 100)));
    connection.on('referral:created', (referral: Referral) => setReferrals((current) => [referral, ...current.filter((item) => item.id !== referral.id)]));
    connection.on('referral:updated', (updated: Referral) => setReferrals((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item)));
    connection.on('connect_error', (socketError) => setError(socketError.message));
    setSocket(connection);
    return () => { connection.disconnect(); setSocket(null); };
  }, [user]);

  const counts = useMemo(() => ({
    all: referrals.length,
    pending: referrals.filter((item) => item.status === 'pending').length,
    contacted: referrals.filter((item) => item.status === 'contacted').length,
    accepted: referrals.filter((item) => item.status === 'accepted').length,
    rejected: referrals.filter((item) => item.status === 'rejected').length
  }), [referrals]);

  const visibleReferrals = useMemo(() => referrals.filter((item) => {
    const matchesFilter = activeFilter === 'all' || item.status === activeFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || item.candidateEmail.toLowerCase().includes(query) || item.note.toLowerCase().includes(query) || displayName(item).toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [referrals, activeFilter, search]);

  const authenticate = async (form: FormData) => {
    setError('');
    try {
      const result = authMode === 'login'
        ? await login(String(form.get('email')), String(form.get('password')))
        : await signup({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')), organizationName: String(form.get('organizationName')), organizationSlug: String(form.get('organizationName')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') });
      setAccessToken(result.accessToken); setUser(result.user); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in'); }
  };

  const createReferral = async (form: FormData) => {
    setError('');
    try {
      await api('/referrals', { method: 'POST', body: JSON.stringify({ candidateEmail: String(form.get('email')), note: String(form.get('note') ?? '') }) });
      setDialogOpen(false); setNotice('Your referral is live.'); window.setTimeout(() => setNotice(''), 3200);
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create referral'); }
  };

  const changeStatus = async (id: string, status: ReferralStatus) => {
    setError('');
    try { await api(`/referrals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update referral'); }
  };

  const signOut = async () => { try { await logout(); } finally { setAccessToken(null); setUser(null); setSocket(null); setReferrals([]); setEvents([]); } };

  if (booting) return <div className="boot-screen"><div className="brand-mark">r</div><span>Opening your workspace…</span></div>;
  if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={authenticate} error={error} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#home"><span className="brand-mark">r</span><span className="brand-name">relay<span className="brand-period">.</span></span></a>
      <div className="workspace-switcher"><div className="workspace-avatar">{initials(user.name)}</div><div className="workspace-copy"><strong>{user.email.split('@')[1]?.split('.')[0] ?? 'Workspace'}</strong><span>{user.role === 'admin' ? 'Administrator' : 'Team workspace'}</span></div><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav"><a className="nav-item nav-active" href="#dashboard" onClick={() => setMobileNavOpen(false)}><LayoutDashboard size={17} /> Overview <span className="nav-current" /></a><a className="nav-item" href="#referrals" onClick={() => setMobileNavOpen(false)}><BriefcaseBusiness size={17} /> Referrals <span className="nav-count">{counts.all}</span></a><a className="nav-item" href="#activity" onClick={() => setMobileNavOpen(false)}><Activity size={17} /> Activity feed</a></nav>
      <div className="nav-label nav-label-manage">MANAGE</div>
      <nav className="main-nav"><button className="nav-item nav-button" onClick={() => setNotice('Your team is connected to this private workspace.')}><Users size={17} /> Team</button><button className="nav-item nav-button" onClick={() => setNotice('Workspace settings are coming soon.')}><Settings2 size={17} /> Settings</button></nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-help"><div className="help-icon"><Sparkles size={16} /></div><div><strong>A warmer network</strong><span>Good people open doors.</span></div><button aria-label="Workspace information" onClick={() => setNotice('Relay helps your team make warm, trackable introductions.')}><CircleHelp size={15} /></button></div>
      <div className="sidebar-profile"><div className="profile-avatar">{initials(user.name)}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button profile-logout" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut size={16} /></button></div>
    </aside>

    <main className="main-area" id="dashboard">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Overview</strong></div><div className="topbar-actions"><div className="connection-state"><span className={`connection-dot ${socket?.connected ? '' : 'connection-off'}`} />{socket?.connected ? 'Live updates on' : 'Connecting'}</div><button className="topbar-bell icon-button" aria-label="Activity notifications" onClick={() => document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth' })}><Bell size={17} /><span className="bell-indicator" /></button><div className="topbar-divider" /><div className="topbar-user"><div className="profile-avatar profile-avatar-small">{initials(user.name)}</div><span>{user.name.split(' ')[0]}</span><ChevronDown size={14} /></div></div></header>

      <div className="page-content">
        <div className="welcome-row"><div><p className="eyebrow welcome-eyebrow">MONDAY, MAY 20, 2024 <span className="eyebrow-dot">·</span> YOUR NETWORK, IN MOTION</p><h1>Good morning, {user.name.split(' ')[0]} <span className="wave">✳</span></h1><p className="welcome-subtitle">Every introduction is a chance to change someone's story.</p></div><button className="primary-button" onClick={() => { setError(''); setDialogOpen(true); }}><Plus size={17} /> Make a referral</button></div>

        <section className="welcome-banner"><div className="banner-orbit orbit-one" /><div className="banner-orbit orbit-two" /><div className="banner-copy"><div className="banner-kicker"><span className="banner-spark">✳</span> THE POWER OF A WARM INTRODUCTION</div><h2>Great people know <em>great people.</em></h2><p>Build momentum together. Your network is stronger when it works as one.</p><button onClick={() => { setError(''); setDialogOpen(true); }}>Introduce someone <ArrowRight size={15} /></button></div><div className="banner-illustration"><div className="illustration-orbit illustration-orbit-outer" /><div className="illustration-orbit illustration-orbit-inner" /><div className="illustration-person person-left"><div className="person-halo">J</div><span>JAMIE</span></div><div className="illustration-center"><div className="center-glow" /><div className="center-mark">↗</div></div><div className="illustration-person person-right"><div className="person-halo">A</div><span>ALEX</span></div><div className="illustration-spark spark-a">✳</div><div className="illustration-spark spark-b">✦</div></div><div className="banner-index">NO. 01 <span>—</span> OPEN DOORS</div></section>

        <section className="metrics-grid" aria-label="Referral summary"><MetricCard icon={<ArrowUpRight size={17} />} label="ALL REFERRALS" value={counts.all} helper="Across your network" tone="mint" /><MetricCard icon={<Clock3 size={17} />} label="PENDING" value={counts.pending} helper="Waiting for a first look" tone="sand" /><MetricCard icon={<MessageCircle size={17} />} label="IN CONVERSATION" value={counts.contacted} helper="Moving things forward" tone="blue" /><MetricCard icon={<Check size={17} />} label="ACCEPTED" value={counts.accepted} helper="Good things happening" tone="green" /></section>

        <div className="content-grid"><section className="referrals-panel" id="referrals"><div className="panel-heading referral-heading"><div><p className="eyebrow">YOUR INTRODUCTIONS</p><h2>Referral tracker</h2></div><button className="text-action" onClick={() => setActiveFilter('all')}>View all <ArrowRight size={14} /></button></div><p className="panel-caption">The right introductions, all in one place.</p>
          <div className="table-toolbar"><div className="filter-tabs"><button className={activeFilter === 'all' ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setActiveFilter('all')}>All <span>{counts.all}</span></button><button className={activeFilter === 'pending' ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setActiveFilter('pending')}>Pending <span>{counts.pending}</span></button><button className={activeFilter === 'contacted' ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setActiveFilter('contacted')}>Active <span>{counts.contacted}</span></button><button className={activeFilter === 'accepted' ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setActiveFilter('accepted')}>Won <span>{counts.accepted}</span></button></div><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search referrals..." /></label><button className="icon-button table-filter" aria-label="Filter referrals" onClick={() => setActiveFilter(activeFilter === 'rejected' ? 'all' : 'rejected')}><Filter size={15} /></button></div>
          <div className="referral-table-wrap"><table className="referral-table"><thead><tr><th>INTRODUCED</th><th>INTRODUCED BY</th><th>STATUS</th><th>DATE ADDED</th><th aria-label="Actions" /></tr></thead><tbody>
            {visibleReferrals.map((referral) => <tr key={referral.id}><td><div className="candidate-cell"><div className={`candidate-avatar candidate-${initials(referral.candidateEmail).charCodeAt(0) % 5}`}>{initials(referral.candidateEmail.split('@')[0].replace(/[._-]/g, ' '))}</div><div><strong>{referral.candidateEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong><span>{referral.candidateEmail}</span>{referral.note && <span className="candidate-note">{referral.note}</span>}</div></div></td><td><div className="introduced-by"><span className="by-avatar">{initials(displayName(referral))}</span>{displayName(referral)}</div></td><td><div className="status-select-wrap"><StatusBadge status={referral.status} /><select aria-label={`Update status for ${referral.candidateEmail}`} value={referral.status} onChange={(event) => void changeStatus(referral.id, event.target.value as ReferralStatus)}><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select><ChevronDown className="status-chevron" size={12} /></div></td><td><span className="date-cell"><CalendarDays size={13} />{new Date(referral.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td><td><button className="row-action" aria-label={`Open ${referral.candidateEmail} referral details`} onClick={() => setNotice(referral.note || `Referral for ${referral.candidateEmail}`)}><ArrowRight size={15} /></button></td></tr>)}
            {!loading && visibleReferrals.length === 0 && <tr><td colSpan={5}><div className="table-empty"><div className="empty-icon">✳</div><strong>{search ? 'No matches found' : 'Your next introduction starts here'}</strong><span>{search ? 'Try another email or clear your search.' : 'Add someone to get your referral network moving.'}</span>{!search && <button onClick={() => setDialogOpen(true)}><Plus size={14} /> Make your first referral</button>}</div></td></tr>}
            {loading && visibleReferrals.length === 0 && <tr><td colSpan={5}><div className="table-loading"><span className="spinner" /> Gathering your referrals…</div></td></tr>}
          </tbody></table></div><div className="table-footer"><span>Showing <strong>{visibleReferrals.length}</strong> of <strong>{referrals.length}</strong> referrals</span><div className="pagination"><button className="page-button" disabled aria-label="Previous page"><ArrowLeft size={14} /></button><button className="page-number page-number-active">1</button><button className="page-button" disabled aria-label="Next page"><ArrowRight size={14} /></button></div></div>
        </section><div id="activity"><ActivityFeed events={events} loading={loading} /></div></div>
        <footer className="page-footer"><span>Built on trust. Powered by people.</span><span><ShieldCheck size={13} /> Your workspace is private and secure</span></footer>
      </div>
    </main>

    {mobileNavOpen && <button aria-label="Close navigation" className="nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
    {dialogOpen && <Modal title="Make a referral" onClose={() => setDialogOpen(false)}><p className="modal-subtitle">A thoughtful introduction can be the start of something great.</p><form onSubmit={(event) => { event.preventDefault(); void createReferral(new FormData(event.currentTarget)); }} className="modal-form"><label>Candidate email<input name="email" type="email" placeholder="someone@example.com" required maxLength={254} /></label><label>A note for your team <span className="optional">OPTIONAL</span><textarea name="note" placeholder="What makes this person a great fit?" rows={4} maxLength={1000} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDialogOpen(false)}>Cancel</button><button className="primary-button" type="submit"><ArrowUpRight size={16} /> Send introduction</button></div></form></Modal>}
    {notice && <div className="toast"><span className="toast-check"><Check size={14} /></span>{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {error && !dialogOpen && <button className="error-toast" onClick={() => setError('')}>{error} <X size={15} /></button>}
  </div>;
}

function MetricCard({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: number; helper: string; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon metric-${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value.toString().padStart(2, '0')}</strong><small>{helper}</small></div><div className="metric-trend"><ArrowDown size={12} /></div></article>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="modal-mark"><ArrowUpRight size={17} /></span><div><p className="eyebrow">OPEN A DOOR</p><h2 id="modal-title">{title}</h2></div></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

function AuthScreen({ mode, setMode, onSubmit, error }: { mode: 'login' | 'signup'; setMode: (mode: 'login' | 'signup') => void; onSubmit: (form: FormData) => void; error: string }) {
  return <main className="auth-page"><section className="auth-visual"><a className="brand auth-brand" href="#home"><span className="brand-mark">r</span><span className="brand-name">relay<span className="brand-period">.</span></span></a><div className="auth-art"><div className="auth-circle auth-circle-one"/><div className="auth-circle auth-circle-two"/><div className="auth-art-spark">✳</div><div className="auth-connection"><div className="auth-person auth-person-one"><span>J</span><small>JAMIE</small></div><div className="auth-link">↗</div><div className="auth-person auth-person-two"><span>A</span><small>ALEX</small></div></div></div><div className="auth-quote"><p>“A warm introduction<br />can change everything.”</p><span>GOOD PEOPLE OPEN DOORS.</span></div><div className="auth-visual-foot"><span>HUMAN CONNECTION, AT WORK.</span><span>01 — 03</span></div></section><section className="auth-main"><div className="auth-main-inner"><div className="auth-mobile-brand brand"><span className="brand-mark">r</span><span className="brand-name">relay<span className="brand-period">.</span></span></div><div className="auth-heading"><p className="eyebrow">YOUR PEOPLE ARE YOUR SUPERPOWER</p><h1>{mode === 'login' ? 'Welcome back.' : 'Build your network.'}</h1><p>{mode === 'login' ? 'Pick up where your introductions left off.' : 'Create a home for your best introductions.'}</p></div><form onSubmit={(event) => { event.preventDefault(); void onSubmit(new FormData(event.currentTarget)); }} className="auth-form">{mode === 'signup' && <><label>Your name<input name="name" placeholder="Jordan Lee" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Organization name<input name="organizationName" placeholder="Acme Studio" required minLength={2} maxLength={100} /></label></>}<label>Work email<input name="email" type="email" placeholder="you@company.com" required maxLength={254} autoComplete="email" /></label><label>Password<div className="password-input"><input name="password" type="password" placeholder="At least 8 characters" required minLength={mode === 'signup' ? 8 : 1} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{mode === 'login' && <button type="button" className="forgot-link" onClick={() => setMode('signup')}>NEW HERE?</button>}</div></label>{error && <div className="form-error">{error}</div>}<button className="primary-button auth-submit" type="submit">{mode === 'login' ? 'Sign in to Relay' : 'Create your workspace'}<ArrowRight size={16} /></button></form><div className="auth-switch">{mode === 'login' ? <>New around here? <button onClick={() => { setMode('signup'); }}>Create an account <ArrowRight size={13} /></button></> : <>Already have a workspace? <button onClick={() => setMode('login')}>Sign in <ArrowRight size={13} /></button></>}</div><div className="demo-access"><span>DEMO WORKSPACE</span><div><strong>admin@acme.test</strong><button type="button" onClick={() => { const form = new FormData(); form.set('email', 'admin@acme.test'); form.set('password', 'DemoAdmin123!'); void onSubmit(form); }}>Use demo account</button></div><small>Local demo password: DemoAdmin123!</small></div><p className="auth-legal"><ShieldCheck size={13} /> Private by design. Your introductions stay in your organization.</p></div></section></main>;
}

export default App;
