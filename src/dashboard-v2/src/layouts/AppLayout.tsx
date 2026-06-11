import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldAlert, Activity, Settings as SettingsIcon,
  LogOut, Zap, BookOpen, Bot, User, ChevronUp, Shield, RefreshCw,
  WifiOff, Wifi, Megaphone, Sliders, ChevronLeft, Bell, Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getRoleLabel, getRoleColor, getAvatarUrl } from '../lib/auth';
import { getPendingSyncCount, triggerManualSync } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from '../components/Tooltip';
import NotificationCenter from '../components/NotificationCenter';
import { getGlassClass } from '../lib/theme';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home', path: '/home', translationKey: 'nav.home' },
  { icon: ShieldAlert, label: 'Cases', path: '/cases', translationKey: 'nav.cases' },
  { icon: Users, label: 'Staff', path: '/staff', translationKey: 'nav.staff' },
  { icon: Bot, label: 'AI Agent', path: '/ai-agent', translationKey: 'nav.ai-agent' },
  { icon: Shield, label: 'Erişim', path: '/access', translationKey: 'nav.access' },
  { icon: Megaphone, label: 'Duyurular', path: '/announcements', translationKey: 'nav.announcements' },
  { icon: Sliders, label: 'Bot Ayarları', path: '/bot-setup', translationKey: 'nav.botSetup' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout, loading, refreshSession } = useAuth();
  const { t, language } = useLanguage();
  
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Theme states
  const [theme, setTheme] = useState<'midnight' | 'deepspace' | 'sunset' | 'arctic'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'lavender') return 'midnight';
    if (stored === 'corporate') return 'sunset';
    if (stored === 'light') return 'arctic';
    return 'deepspace';
  });

  const [intensity, setIntensity] = useState<string>(() => {
    return localStorage.getItem('lutheus-intensity') || 'frosted';
  });

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('lutheus-isCollapsed') === 'true';
  });

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('lutheus-isCollapsed', String(nextState));
  };

  // Sidebar resizable state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('lutheus-sidebarWidth');
    return saved ? parseInt(saved, 10) : 245;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 180) newWidth = 180;
      if (newWidth > 450) newWidth = 450;
      setSidebarWidth(newWidth);
      localStorage.setItem('lutheus-sidebarWidth', String(newWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handleThemeChange = () => {
      const stored = localStorage.getItem('theme');
      if (stored === 'lavender') setTheme('midnight');
      else if (stored === 'corporate') setTheme('sunset');
      else if (stored === 'light') setTheme('arctic');
      else setTheme('deepspace');
    };
    const handleIntensityChange = () => {
      setIntensity(localStorage.getItem('lutheus-intensity') || 'frosted');
    };
    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('storage', handleIntensityChange);
    window.addEventListener('lutheus-theme-change', handleThemeChange);
    window.addEventListener('lutheus-intensity-change', handleIntensityChange);
    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('storage', handleIntensityChange);
      window.removeEventListener('lutheus-theme-change', handleThemeChange);
      window.removeEventListener('lutheus-intensity-change', handleIntensityChange);
    };
  }, []);

  const isAuthorized = (path: string) => {
    const role = session?.role?.toLowerCase() || '';
    const isMgmt = ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(role);
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

  // Poll for status updates to automatically redirect pending/blocked/former staff when approved
  useEffect(() => {
    if (!session) return;
    const role = session.role?.toLowerCase() || '';
    if (role === 'pending' || role === 'blocked' || role === 'eski_yetkili') {
      const interval = setInterval(() => {
        if (refreshSession) {
          refreshSession();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [session, refreshSession]);

  // Check if they already requested access on mount
  useEffect(() => {
    if (!session) return;
    const role = session.role?.toLowerCase() || '';
    if (role === 'pending') {
      const checkRequestStatus = async () => {
        try {
          const { supabaseFetch } = await import('../lib/supabase');
          const data = await supabaseFetch<any[]>('staff_profiles', 'GET', `discord_id=eq.${session.profile.discordId}`);
          if (data && data[0] && data[0].access_requested_at) {
            setAccessRequested(true);
          }
        } catch (e) {
          console.warn('Failed to query initial request access status:', e);
        }
      };
      checkRequestStatus();
    }
  }, [session]);

  const handleRequestAccess = async () => {
    if (!session?.idToken) return;
    setRequestingAccess(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: any };
      await AdminApiClient.requestAccess();
      setAccessRequested(true);
    } catch (err) {
      console.error('Request access error:', err);
    } finally {
      setRequestingAccess(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync();
      await getPendingSyncCount().then(setPendingSync);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#050506]">
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <div
              key={d}
              className="w-2 h-2 rounded-full bg-[#5E5CE6] animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Block dashboard access entirely for Former Staff (eski_yetkili), Blocked (blocked), or Pending (pending) role
  const userRole = session?.role?.toLowerCase() || '';
  if (userRole === 'eski_yetkili' || userRole === 'blocked' || userRole === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#050506] text-white p-6 relative">
        <div className="bg-overlay" />
        <div className={cn("max-w-md w-full text-center space-y-6 rounded-[28px] p-8 shadow-2xl", getGlassClass(intensity, theme))}>
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('nav.accessDenied')}</h1>
            <p className="text-sm text-white/60">
              {userRole === 'blocked' 
                ? (language === 'tr' ? 'Hesabınız engellendiği için moderasyon paneline erişim izniniz bulunmamaktadır.' : 'You do not have permission to access the moderation panel because your account has been blocked.')
                : userRole === 'eski_yetkili'
                  ? (language === 'tr' ? 'Eski yetkili rütbesine sahip olduğunuz için moderasyon paneline erişim izniniz bulunmamaktadır.' : 'You do not have permission to access the moderation panel because you have the Former Staff role.')
                  : (language === 'tr' ? 'Hesabınız henüz onaylanmadığı için moderasyon paneline erişim izniniz bulunmamaktadır.' : 'You do not have permission to access the moderation panel because your account has not been approved yet.')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {userRole === 'pending' && (
              <button
                onClick={handleRequestAccess}
                disabled={requestingAccess || accessRequested}
                className={cn(
                  "w-full flex items-center justify-center gap-2 h-11 px-4 rounded-[14px] font-semibold transition-all shadow-lg cursor-pointer",
                  accessRequested 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-not-allowed shadow-none"
                    : "bg-[#5E5CE6] text-white hover:bg-[#5E5CE6]/90 shadow-[#5E5CE6]/25"
                )}
              >
                {requestingAccess ? (
                  <span className="flex gap-1 items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : accessRequested ? (
                  <>
                    <Check className="w-4 h-4" /> Erişim Talebi Gönderildi
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" /> Erişim Talep Et
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-[14px] bg-[#FF453A] text-white font-semibold hover:bg-[#FF453A]/90 transition-colors shadow-lg shadow-[#FF453A]/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roleColor = session ? getRoleColor(session.role) : '#64748b';
  const roleLabel = session ? getRoleLabel(session.role) : '';
  const displayName = session?.profile?.displayName || session?.profile?.username || 'Kullanıcı';
  const avatarUrl = getAvatarUrl(session);

  const getBrandGradient = () => {
    switch (theme) {
      case 'midnight': return 'from-[#5E5CE6] to-[#A259FE] shadow-[#5E5CE6]/25';
      case 'sunset': return 'from-[#FF453A] to-[#FF9F0A] shadow-[#FF453A]/25';
      case 'arctic': return 'from-[#0DF5FF] to-[#32D74B] shadow-[#0DF5FF]/25';
      case 'deepspace':
      default: return 'from-white to-neutral-500 shadow-white/[0.05]';
    }
  };

  const getBrandTextColors = () => {
    switch (theme) {
      case 'midnight': return 'text-[#A259FE]';
      case 'sunset': return 'text-[#FF453A]';
      case 'arctic': return 'text-[#0DF5FF];';
      case 'deepspace':
      default: return 'text-neutral-400';
    }
  };

  const getSidebarClass = () => {
    const base = `border-r flex flex-col shrink-0 z-20 select-none ${isResizing ? '' : 'transition-all duration-300'} `;
    if (theme === 'deepspace') {
      return base + "border-white/[0.06] bg-black/75";
    }
    return base + "border-white/[0.04] bg-black/45 backdrop-blur-3xl";
  };

  return (
    <div className="flex h-screen w-full overflow-hidden select-none bg-[#050506] text-white">
      <div className="bg-overlay" />
      
      {/* Sidebar wrapper */}
      <aside 
        className={getSidebarClass()} 
        style={{ width: isCollapsed ? '72px' : `${sidebarWidth}px` }}
      >
        {/* Brand Area */}
        <div className={`h-[70px] ${isCollapsed ? 'px-3 justify-center' : 'px-5'} flex items-center justify-between border-b border-white/[0.02] relative overflow-hidden`}>
          {!isCollapsed && (
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-purple-950/50 to-indigo-950/40 backdrop-blur-[1px]" />
          )}
          <div className="flex items-center gap-2 min-w-0 relative z-10">
            <div className="w-[26px] h-[26px] flex items-center justify-center shrink-0 text-[#5E5CE6]">
              <Shield className="w-5 h-5" strokeWidth={2.5} />
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="overflow-hidden"
              >
                <h1 className="font-bold text-[13px] text-white leading-tight tracking-wide">Lutheus</h1>
                <p className={`text-[8.5px] ${getBrandTextColors()} uppercase tracking-widest font-mono font-bold transition-colors`}>CezaRapor</p>
              </motion.div>
            )}
          </div>
          
          <div className="flex items-center gap-1 shrink-0 relative z-10">
            {!isCollapsed && pendingSync > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all flex items-center justify-center cursor-pointer relative"
                title={`${pendingSync} ${t('nav.pending')}`}
              >
                <WifiOff size={13} className={syncing ? 'animate-spin' : ''} />
              </button>
            )}
            {!isCollapsed && (
              <button 
                onClick={() => setNotificationCenterOpen(true)}
                className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 text-white/50 hover:text-white transition-all cursor-pointer relative"
                title="Bildirimler"
              >
                <Bell size={13} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FF453A]" />
              </button>
            )}
            <button 
              onClick={toggleSidebar}
              className={`p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 text-white/50 hover:text-white transition-all cursor-pointer ${isCollapsed ? 'hidden' : 'block'}`}
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        </div>

        {/* Navigation panel */}
        <nav className={`flex-1 overflow-y-auto hide-scrollbar py-6 ${isCollapsed ? 'px-2 space-y-3' : 'px-3 space-y-1.5'} select-none`}>
          {NAV_ITEMS.filter((item) => isAuthorized(item.path)).map((item) => (
            <NavItem
              key={item.path}
              to={item.path}
              icon={item.icon}
              label={t(item.translationKey)}
              isCollapsed={isCollapsed}
              theme={theme}
              onClick={(e) => handleNavClick(e, item.path)}
            />
          ))}
          {isCollapsed && (
            <button 
              onClick={toggleSidebar}
              className="w-11 h-11 mx-auto flex items-center justify-center rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent transition-all cursor-pointer"
            >
              <ChevronLeft size={16} className="rotate-180" />
            </button>
          )}
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-white/[0.04] relative select-none" ref={profileRef}>
          <AnimatePresence>
            {profileOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className={`absolute bottom-[75px] ${isCollapsed ? 'left-2 w-[210px]' : 'left-3 right-3'} bg-[#0D0D11]/95 border border-white/[0.08] rounded-xl p-2 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] backdrop-blur-2xl z-30 flex flex-col space-y-0.5`}
              >
                {/* Popover header */}
                <div className="px-3 py-2 border-b border-white/[0.04] mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase font-bold">Lutheus Access</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${pendingSync > 0 ? 'bg-amber-500 animate-pulse' : 'bg-[#32D74B]'}`} />
                    <span className={`text-[9px] font-mono font-bold uppercase ${pendingSync > 0 ? 'text-amber-500' : 'text-[#32D74B]'}`}>
                      {pendingSync > 0 ? `${pendingSync} PENDING` : 'ONLINE'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setProfileOpen(false);
                    if (window.__lutheus_is_dirty) {
                      window.dispatchEvent(new CustomEvent('lutheus-dirty-navigate'));
                      alert(language === 'tr' ? 'Lütfen kaydetmediğiniz değişiklikleri kaydetmeden veya iptal etmeden sayfadan ayrılmayın!' : 'Please save or cancel your unsaved changes before leaving this page!');
                      return;
                    }
                    navigate('/staff', { state: { staffId: session?.profile?.discordId } });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors text-left text-[12px] font-semibold cursor-pointer"
                >
                  <User size={13} className="text-white/40" />
                  {t('nav.profile')}
                </button>
                <button 
                  onClick={() => {
                    setProfileOpen(false);
                    if (window.__lutheus_is_dirty) {
                      window.dispatchEvent(new CustomEvent('lutheus-dirty-navigate'));
                      alert(language === 'tr' ? 'Lütfen kaydetmediğiniz değişiklikleri kaydetmeden veya iptal etmeden sayfadan ayrılmayın!' : 'Please save or cancel your unsaved changes before leaving this page!');
                      return;
                    }
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors text-left text-[12px] font-semibold cursor-pointer"
                >
                  <SettingsIcon size={13} className="text-white/40" />
                  {t('nav.settings')}
                </button>
                {pendingSync > 0 && (
                  <button 
                    disabled={syncing}
                    onClick={handleSync}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 transition-colors text-left text-[12px] font-bold cursor-pointer"
                  >
                    <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Eşitleniyor...' : `Verileri Eşitle (${pendingSync})`}
                  </button>
                )}
                <div className="border-t border-white/[0.04] my-1 pt-1" />
                <button 
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#FF453A]/10 text-white/70 hover:text-[#FF453A] transition-colors text-left text-[12px] font-bold cursor-pointer"
                >
                  <LogOut size={13} className="text-inherit opacity-60" />
                  {t('nav.logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Tooltip content="Bildirimler" position="right">
                <button 
                  onClick={() => setNotificationCenterOpen(true)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl transition-all hover:bg-white/5 border border-transparent hover:border-white/[0.04] text-white/50 hover:text-white relative cursor-pointer"
                >
                  <Bell size={15} />
                  <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full bg-[#FF453A]" />
                </button>
              </Tooltip>
              
              <Tooltip content={`${displayName} Oturum Ayarları`} position="right">
                <button 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className={`w-11 h-11 mx-auto flex items-center justify-center rounded-xl transition-all outline-none border ${
                    profileOpen 
                      ? 'bg-white/[0.06] border-white/10' 
                      : 'hover:bg-white/5 border-transparent hover:border-white/[0.04]'
                  }`}
                >
                  <img 
                    src={avatarUrl} 
                    onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=11"; }}
                    alt="Avatar" 
                    className="w-7 h-7 rounded-lg object-cover border border-white/10" 
                  />
                </button>
              </Tooltip>
            </div>
          ) : (
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all text-left outline-none group border ${
                profileOpen 
                  ? 'bg-white/[0.06] border-white/10 shadow-inner' 
                  : 'hover:bg-white/5 border-transparent hover:border-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img 
                  src={avatarUrl} 
                  onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=11"; }}
                  alt={`${displayName} Avatar`} 
                  className="w-8 h-8 rounded-lg object-cover opacity-90 border border-white/10" 
                />
                <div className="overflow-hidden min-w-0">
                  <p className="text-[12px] font-bold text-white/90 truncate group-hover:text-white leading-tight">{displayName}</p>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest mt-0.5 truncate" style={{ color: roleColor }}>{roleLabel}</p>
                </div>
              </div>
              <ChevronUp size={12} className={`text-white/40 group-hover:text-white transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </aside>

      {/* Resizer Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizing}
          className="w-[4px] hover:w-[6px] active:w-[6px] h-full cursor-col-resize bg-white/[0.03] hover:bg-[#5E5CE6]/40 active:bg-[#5E5CE6] transition-all z-30 shrink-0 select-none relative group"
        >
          {/* Subtle grab handle visual */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-[30px] rounded-full bg-white/10 group-hover:bg-white/30" />
        </div>
      )}

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col relative z-10 min-w-0 bg-transparent h-full overflow-hidden">
        {/* Scrollable Subpage Content Container */}
        <div className="flex-1 overflow-auto hide-scrollbar relative flex flex-col" id="scroll-main">
          {/* Page Routing Authorization Check wrapper */}
          <div className="flex-1 flex flex-col w-full">
            {(() => {
              const currentNav = NAV_ITEMS.find((n) => location.pathname.startsWith(n.path));
              const isPageAuthorized = !currentNav || isAuthorized(currentNav.path);

              if (!isPageAuthorized) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className={cn("max-w-md w-full rounded-[24px] p-8 shadow-xl text-center space-y-4", getGlassClass(intensity, theme))}>
                      <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-bold">{t('nav.unauthorized')}</h2>
                      <p className="text-sm text-white/60">
                        {t('nav.unauthorizedDesc')}
                      </p>
                    </div>
                  </div>
                );
              }
              
              return (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
                    className="flex-1 flex flex-col min-w-0"
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              );
            })()}
          </div>
        </div>
      </main>

      {/* Global Notification Center Drawer */}
      <NotificationCenter isOpen={notificationCenterOpen} onClose={() => setNotificationCenterOpen(false)} />
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  isCollapsed: boolean;
  theme: string;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function NavItem({ to, icon: Icon, label, isCollapsed, theme, onClick }: NavItemProps) {
  const getActiveStyles = () => {
    switch (theme) {
      case 'midnight': return 'bg-[#5E5CE6]/10 text-[#5E5CE6] border-[#5E5CE6]/15 font-bold shadow-[#5E5CE6]/5';
      case 'sunset': return 'bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/15 font-bold shadow-[#FF453A]/5';
      case 'arctic': return 'bg-[#0DF5FF]/10 text-[#0DF5FF] border-[#0DF5FF]/15 font-bold shadow-[#0DF5FF]/5';
      case 'deepspace':
      default: return 'bg-white/10 text-white border-white/15 font-bold shadow-none';
    }
  };

  const linkContent = (
    <NavLink 
      to={to} 
      onClick={onClick}
      className={({isActive}) => `flex items-center ${isCollapsed ? 'justify-center w-11 h-11' : 'gap-2.5 px-3 py-2'} rounded-xl text-[12.5px] transition-all outline-none border ${
        isActive 
          ? `${getActiveStyles()} shadow-sm` 
          : 'text-white/40 hover:bg-white/[0.03] hover:text-white/80 border-transparent font-medium'
      }`}
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={label} position="right">
        <div className="flex justify-center w-full px-1">
          {linkContent}
        </div>
      </Tooltip>
    );
  }

  return linkContent;
}
