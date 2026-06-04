import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldAlert, Activity, Settings as SettingsIcon,
  LogOut, Search, Zap, BookOpen, Bot, User, ChevronUp, Shield, RefreshCw,
  WifiOff, Wifi, Megaphone, Sliders,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getRoleLabel, getRoleColor, getAvatarUrl } from '../lib/auth';
import { getPendingSyncCount, triggerManualSync } from '../lib/supabase';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home', path: '/home', translationKey: 'nav.home' },
  { icon: ShieldAlert, label: 'Cases', path: '/cases', translationKey: 'nav.cases' },
  { icon: Users, label: 'Staff', path: '/staff', translationKey: 'nav.staff' },
  { icon: Zap, label: 'Pointtrain', path: '/pointtrain', translationKey: 'nav.pointtrain' },
  { icon: BookOpen, label: 'CUK Editörü', path: '/rules', translationKey: 'nav.rules' },
  { icon: Bot, label: 'AI Agent', path: '/ai-agent', translationKey: 'nav.ai-agent' },
  { icon: Shield, label: 'Erişim', path: '/access', translationKey: 'nav.access' },
  { icon: Megaphone, label: 'Duyurular', path: '/announcements', translationKey: 'nav.announcements' },
  { icon: Sliders, label: 'Bot Ayarları', path: '/bot-setup', translationKey: 'nav.botSetup' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout, loading } = useAuth();
  const { t, language } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isAuthorized = (path: string) => {
    const role = session?.role?.toLowerCase() || '';
    const isMgmt = ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi'].includes(role);
    const isSenior = ['kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(role);

    if (path === '/access' || path === '/rules' || path === '/announcements' || path === '/bot-setup') {
      return isMgmt;
    }
    if (path === '/pointtrain' || path === '/scan') {
      return isMgmt || isSenior;
    }
    return true;
  };

  // Block close / reload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (window.__lutheus_is_dirty) {
        e.preventDefault();
        e.returnValue = language === 'tr' ? 'Kaydedilmemiş değişiklikleriniz var. Sayfadan ayrılmak istediğinize emin misiniz?' : 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [language]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (window.__lutheus_is_dirty) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('lutheus-dirty-navigate', { detail: { path } }));
      alert(language === 'tr' ? 'Lütfen kaydetmediğiniz değişiklikleri kaydetmeden veya iptal etmeden sayfadan ayrılmayın!' : 'Please save or cancel your unsaved changes before leaving this page!');
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll sync queue count every 10s
  useEffect(() => {
    const refresh = () => getPendingSyncCount().then(setPendingSync);
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <div
              key={d}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync();
      await getPendingSyncCount().then(setPendingSync);
    } finally {
      setSyncing(false);
    }
  };

  const getPageTitle = () => {
    const all = [...NAV_ITEMS, { label: 'Settings', path: '/settings', translationKey: 'nav.settings' }];
    const item = all.find((n) => location.pathname.startsWith(n.path));
    return item ? t(item.translationKey) : 'Dashboard';
  };

  // Block dashboard access entirely for Former Staff (eski_yetkili), Blocked (blocked), or Pending (pending) role
  const userRole = session?.role?.toLowerCase() || '';
  if (userRole === 'eski_yetkili' || userRole === 'blocked' || userRole === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-background text-foreground p-6">
        <div className="max-w-md w-full text-center space-y-6 bg-card border border-border/50 rounded-[28px] p-8 glass-panel shadow-2xl animate-in fade-in">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('nav.accessDenied')}</h1>
            <p className="text-sm text-muted-foreground">
              {userRole === 'blocked' 
                ? (language === 'tr' ? 'Hesabınız engellendiği için moderasyon paneline erişim izniniz bulunmamaktadır.' : 'You do not have permission to access the moderation panel because your account has been blocked.')
                : userRole === 'eski_yetkili'
                  ? (language === 'tr' ? 'Eski yetkili rütbesine sahip olduğunuz için moderasyon paneline erişim izniniz bulunmamaktadır.' : 'You do not have permission to access the moderation panel because you have the Former Staff role.')
                  : (language === 'tr' ? 'Hesabınız henüz onaylanmadığı için moderasyon paneline erişim izniniz bulunmamaktadır.' : 'You do not have permission to access the moderation panel because your account has not been approved yet.')}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-[14px] bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90 transition-colors shadow-lg shadow-destructive/20"
          >
            <LogOut className="w-4 h-4" /> {t('nav.logout')}
          </button>
        </div>
      </div>
    );
  }

  const roleColor = session ? getRoleColor(session.role) : '#64748b';
  const roleLabel = session ? getRoleLabel(session.role) : '';
  const displayName = session?.profile?.displayName || session?.profile?.username || 'Kullanıcı';
  const avatarUrl = getAvatarUrl(session);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 m-3 mr-0 rounded-[28px] bg-card border border-border/50 shadow-sm glass-panel overflow-visible relative flex-shrink-0">
        {/* Logo */}
        <button
          type="button"
          onClick={() => { window.location.href = '/'; }}
          aria-label="Ana sayfaya dön"
          className="p-5 flex items-center gap-3 w-full text-left rounded-[20px] hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <img
            src="favicon_shield.png"
            width="32"
            height="32"
            alt="Lutheus Logo"
            className="shrink-0"
            style={{ filter: 'drop-shadow(0px 0px 8px rgba(124, 90, 245, 0.5))' }}
          />
          <div>
            <div className="font-bold text-sm tracking-tight text-foreground">Lutheus</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">CezaRapor</div>
          </div>
        </button>

        {/* Sync indicator */}
        {pendingSync > 0 && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-400">{pendingSync} {t('nav.pending')}</span>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              {syncing ? '...' : t('nav.sync')}
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto soft-scroll">
          {NAV_ITEMS.filter((item) => isAuthorized(item.path)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => handleNavClick(e, item.path)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-primary/12 text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {t(item.translationKey)}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile */}
        <div className="p-3 border-t border-border/50 relative" ref={profileRef}>
          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border/50 rounded-[18px] shadow-xl glass-panel z-50 p-1.5 animate-in fade-in">
              <button
                onClick={() => {
                  if (window.__lutheus_is_dirty) {
                    window.dispatchEvent(new CustomEvent('lutheus-dirty-navigate'));
                    alert(language === 'tr' ? 'Lütfen kaydetmediğiniz değişiklikleri kaydetmeden veya iptal etmeden sayfadan ayrılmayın!' : 'Please save or cancel your unsaved changes before leaving this page!');
                    return;
                  }
                  navigate('/staff', { state: { staffId: session?.profile?.discordId } });
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground rounded-xl transition-colors text-left"
              >
                <User className="w-4 h-4" /> {t('nav.profile')}
              </button>
              <button
                onClick={() => {
                  if (window.__lutheus_is_dirty) {
                    window.dispatchEvent(new CustomEvent('lutheus-dirty-navigate'));
                    alert(language === 'tr' ? 'Lütfen kaydetmediğiniz değişiklikleri kaydetmeden veya iptal etmeden sayfadan ayrılmayın!' : 'Please save or cancel your unsaved changes before leaving this page!');
                    return;
                  }
                  navigate('/settings');
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground rounded-xl transition-colors text-left mt-0.5"
              >
                <SettingsIcon className="w-4 h-4" /> {t('nav.settings')}
              </button>
              <button
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors text-left mt-0.5"
              >
                <LogOut className="w-4 h-4" /> {t('nav.logout')}
              </button>
            </div>
          )}

          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 w-full p-2 rounded-[14px] hover:bg-secondary/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden shrink-0 border-2 border-border/50">
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] truncate text-foreground">{displayName}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide truncate mt-0.5" style={{ color: roleColor }}>
                {roleLabel}
              </div>
            </div>
            <ChevronUp className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', profileOpen && 'rotate-180')} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar */}
        <header className="h-[72px] flex items-center justify-between px-6 shrink-0">
          <h1 className="text-xl font-bold tracking-tight">{getPageTitle()}</h1>

          <div className="flex flex-1 justify-end items-center gap-3">
            {/* Sync status pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border/50">
              {pendingSync > 0
                ? <WifiOff className="w-3 h-3 text-amber-400" />
                : <Wifi className="w-3 h-3 text-emerald-400" />}
              <span className="text-[11px] font-medium text-muted-foreground">
                {pendingSync > 0 ? `${pendingSync} ${t('nav.pending')}` : t('nav.synced')}
              </span>
              {pendingSync > 0 && (
                <button onClick={handleSync} disabled={syncing} className="ml-1">
                  <RefreshCw className={cn('w-3 h-3 text-amber-400', syncing && 'animate-spin')} />
                </button>
              )}
            </div>

            <div className="relative hidden sm:block w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('nav.search')}
                className="h-9 w-full rounded-[12px] bg-card border border-border/50 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-auto px-4 md:px-6 pb-6 soft-scroll">
          <div className="max-w-6xl mx-auto">
            {(() => {
              const currentNav = NAV_ITEMS.find((n) => location.pathname.startsWith(n.path));
              const isPageAuthorized = !currentNav || isAuthorized(currentNav.path);

              if (!isPageAuthorized) {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 bg-card border border-border/50 rounded-[24px] p-8 glass-panel animate-in">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold">{t('nav.unauthorized')}</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {t('nav.unauthorizedDesc')}
                    </p>
                  </div>
                );
              }
              return <Outlet />;
            })()}
          </div>
        </div>
      </main>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 bg-card h-14 flex items-center justify-around px-2 z-40">
        {NAV_ITEMS.filter((item) => isAuthorized(item.path)).slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn('flex flex-col items-center justify-center w-10 h-10 rounded-full', isActive ? 'text-primary' : 'text-muted-foreground')
              }
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
