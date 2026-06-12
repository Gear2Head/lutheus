import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutGrid, Shield, Users, Zap, BookOpen, Activity, MessageSquare, 
  Settings, Layers, User, LogOut, ChevronUp, Bell, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Tooltip from './Tooltip-Lutheus';
import NotificationCenter from './NotificationCenter-Lutheus';

export default function LutheusLayout({ children }: { children: React.ReactNode }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Dynamic user profile from localStorage with fallback
  const [activeUser, setActiveUser] = useState(() => {
    if (typeof window === 'undefined') return {
      user: "Gear_Head",
      role: "KURUCU",
      avatar: "https://i.ibb.co/3sS1wsh/gearhead-avatar.png"
    };
    
    const saved = localStorage.getItem('lutheus-activeUser');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      user: "Gear_Head",
      role: "KURUCU",
      avatar: "https://i.ibb.co/3sS1wsh/gearhead-avatar.png"
    };
  });

  useEffect(() => {
    const handleUserChange = () => {
      const saved = localStorage.getItem('lutheus-activeUser');
      if (saved) {
        try {
          setActiveUser(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener('lutheus-user-change', handleUserChange);
    return () => window.removeEventListener('lutheus-user-change', handleUserChange);
  }, []);

  // Supabase sync time state
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setLastSyncTime(customEvent.detail);
      }
    };
    window.addEventListener('supabase-sync-time', handleSync);
    return () => window.removeEventListener('supabase-sync-time', handleSync);
  }, []);

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lutheus-isCollapsed') === 'true';
  });

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('lutheus-isCollapsed', String(nextState));
  };

  // Handle clicking outside profile menu dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const theme = 'midnight' as any;

  const getBrandGradient = () => {
    switch (theme) {
      case 'midnight': return 'from-[#5E5CE6] to-[#A259FE] shadow-[#5E5CE6]/25';
      case 'deepspace': return 'from-white to-neutral-500 shadow-white/[0.05]';
      case 'sunset': return 'from-[#FF453A] to-[#FF9F0A] shadow-[#FF453A]/25';
      case 'arctic': return 'from-[#0DF5FF] to-[#32D74B] shadow-[#0DF5FF]/25';
    }
  };

  const getBrandTextColors = () => {
    switch (theme) {
      case 'midnight': return 'text-[#A259FE]';
      case 'deepspace': return 'text-neutral-400';
      case 'sunset': return 'text-[#FF453A]';
      case 'arctic': return 'text-[#0DF5FF]';
    }
  };

  const getSidebarClass = () => {
    const widthClass = isCollapsed ? "w-[72px]" : "w-[245px]";
    const base = `${widthClass} border-r flex flex-col shrink-0 z-20 select-none transition-all duration-300 `;
    if (theme === 'deepspace') {
      return base + "border-white/[0.06] bg-black/75";
    }
    return base + "border-white/[0.04] bg-black/45 backdrop-blur-3xl";
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex h-screen w-full overflow-hidden select-none bg-[#050506]">
      <div className="bg-overlay" />
      
      {/* Sleek Glassmorphic sidebar */}
      <aside className={getSidebarClass()}>
        
        {/* Brand Area */}
        <div className={`h-[70px] ${isCollapsed ? 'px-3 justify-center' : 'px-5'} flex items-center justify-between border-b border-white/[0.02]`}>
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <img src="/dashboard/icon128.png" className="w-full h-full object-contain" alt="Lutheus Logo" />
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="overflow-hidden"
              >
                <h1 className="font-bold text-[13.5px] text-white leading-tight tracking-wide">Lutheus</h1>
                <p className={`text-[9px] ${getBrandTextColors()} uppercase tracking-widest font-mono font-bold transition-colors`}>CezaRapor</p>
              </motion.div>
            )}
          </Link>
          
          <div className="flex items-center gap-1 shrink-0">
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
          <NavItem href="/dashboard" icon={LayoutGrid} label="Ana Sayfa" isCollapsed={isCollapsed} isActive={isActive('/dashboard')} />
          <NavItem href="/dashboard/penalties" icon={Shield} label="Cezalar" isCollapsed={isCollapsed} isActive={isActive('/dashboard/penalties')} />
          <NavItem href="/dashboard/staff" icon={Users} label="Yetkililer" isCollapsed={isCollapsed} isActive={isActive('/dashboard/staff')} />
          <NavItem href="/dashboard/pointtrain" icon={Zap} label="Pointtrain" isCollapsed={isCollapsed} isActive={isActive('/dashboard/pointtrain')} />
          <NavItem href="/dashboard/editor" icon={BookOpen} label="CUK Editörü" isCollapsed={isCollapsed} isActive={isActive('/dashboard/editor')} />
          <NavItem href="/dashboard/agent" icon={Activity} label="AI Agent" isCollapsed={isCollapsed} isActive={isActive('/dashboard/agent')} />
          <NavItem href="/dashboard/access" icon={Layers} label="Erişim" isCollapsed={isCollapsed} isActive={isActive('/dashboard/access')} />
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
        <div className="p-3 border-t border-white/[0.04] relative select-none" ref={menuRef}>
          <AnimatePresence>
            {profileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className={`absolute bottom-[75px] ${isCollapsed ? 'left-2 w-[210px]' : 'left-3 right-3'} bg-[#0D0D11]/95 border border-white/[0.08] rounded-xl p-2 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] backdrop-blur-2xl z-30 flex flex-col space-y-0.5`}
              >
                <div className="px-3 py-2 border-b border-white/[0.04] mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase font-bold">Lutheus Access</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
                    <span className="text-[9px] font-mono text-[#32D74B] font-bold">ONLINE</span>
                  </div>
                </div>

                <button 
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors text-left text-[12px] font-semibold cursor-pointer"
                >
                  <User size={13} className="text-white/40" />
                  Profil Detayları
                </button>
                <button 
                  onClick={() => {
                    setProfileMenuOpen(false);
                    router.push('/dashboard/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors text-left text-[12px] font-semibold cursor-pointer"
                >
                  <Settings size={13} className="text-white/40" />
                  Lutheus Ayarlar
                </button>
                <button 
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors text-left text-[12px] font-semibold cursor-pointer"
                >
                  <Bell size={13} className="text-white/40" />
                  Bildirimler
                </button>
                <div className="border-t border-white/[0.04] my-1 pt-1" />
                <button 
                  onClick={() => {
                    setProfileMenuOpen(false);
                    localStorage.removeItem('lutheus-activeUser');
                    window.dispatchEvent(new Event('lutheus-user-change'));
                    router.push('/dashboard/access');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#FF453A]/10 text-white/70 hover:text-[#FF453A] transition-colors text-left text-[12px] font-bold cursor-pointer"
                >
                  <LogOut size={13} className="text-inherit opacity-60" />
                  Çıkış Yap
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
              
              <Tooltip content={`${activeUser.user} Oturum Ayarları`} position="right">
                <button 
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className={`w-11 h-11 mx-auto flex items-center justify-center rounded-xl transition-all outline-none border ${
                    profileMenuOpen 
                      ? 'bg-white/[0.06] border-white/10' 
                      : 'hover:bg-white/5 border-transparent hover:border-white/[0.04]'
                  }`}
                >
                  <img 
                    src={activeUser.avatar} 
                    onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=11"; }}
                    alt="Avatar" 
                    className="w-7 h-7 rounded-lg object-cover border border-white/10" 
                  />
                </button>
              </Tooltip>
            </div>
          ) : (
            <button 
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all text-left outline-none group border ${
                profileMenuOpen 
                  ? 'bg-white/[0.06] border-white/10 shadow-inner' 
                  : 'hover:bg-white/5 border-transparent hover:border-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img 
                  src={activeUser.avatar} 
                  onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=11"; }}
                  alt={`${activeUser.user} Avatar`} 
                  className="w-8 h-8 rounded-lg object-cover opacity-90 border border-white/10" 
                />
                <div className="overflow-hidden min-w-0">
                  <p className="text-[12px] font-bold text-white/90 truncate group-hover:text-white leading-tight">{activeUser.user}</p>
                  <p className="text-[9px] text-[#FF453A] font-extrabold uppercase tracking-widest mt-0.5">{activeUser.role}</p>
                </div>
              </div>
              <ChevronUp size={12} className={`text-white/40 group-hover:text-white transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col relative z-10 min-w-0 bg-transparent">
        {/* Floating Supabase Sync Indicator */}
        <div className="absolute top-4 right-6 z-40 flex items-center gap-1.5 px-3 py-1 bg-[#111112]/50 border border-white/[0.06] rounded-full text-[10px] text-white/50 backdrop-blur-md font-mono select-none pointer-events-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B] animate-pulse" />
          <span className="text-[#32D74B]">Supabase</span>
          <span className="text-white/20">•</span>
          <span>Son Senkronizasyon: <span className="text-white font-bold">{lastSyncTime}</span></span>
        </div>

        <div className="flex-1 overflow-auto hide-scrollbar relative flex flex-col" id="scroll-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
              className="flex-1 flex flex-col min-w-0"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      {/* Global Notification Center */}
      <NotificationCenter isOpen={notificationCenterOpen} onClose={() => setNotificationCenterOpen(false)} />
    </div>
  );
}

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  isCollapsed: boolean;
  isActive: boolean;
}

function NavItem({ href, icon: Icon, label, isCollapsed, isActive }: NavItemProps) {
  const theme = 'midnight' as any;
  
  const getActiveStyles = () => {
    switch (theme) {
      case 'midnight': return 'bg-[#5E5CE6]/10 text-[#5E5CE6] border-[#5E5CE6]/15 font-bold shadow-[#5E5CE6]/5';
      case 'deepspace': return 'bg-white/10 text-white border-white/15 font-bold shadow-none';
      case 'sunset': return 'bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/15 font-bold shadow-[#FF453A]/5';
      case 'arctic': return 'bg-[#0DF5FF]/10 text-[#0DF5FF] border-[#0DF5FF]/15 font-bold shadow-[#0DF5FF]/5';
    }
  };

  const linkContent = (
    <Link 
      href={href} 
      className={`flex items-center ${isCollapsed ? 'justify-center w-11 h-11' : 'gap-2.5 px-3 py-2'} rounded-xl text-[12.5px] transition-all outline-none border ${
        isActive 
          ? `${getActiveStyles()} shadow-sm` 
          : 'text-white/40 hover:bg-white/[0.03] hover:text-white/80 border-transparent font-medium'
      }`}
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
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
