import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ShieldAlert, CheckCircle2, UserPlus, Info, Zap, Trash2, Loader2 } from 'lucide-react';
import { getAuditLogs } from '../lib/supabase';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'success' | 'staff' | 'info' | 'system';
  time: string;
  unread: boolean;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'şimdi';
    if (diffMins < 60) return `${diffMins}dk önce`;
    if (diffHrs < 24) return `${diffHrs}sa önce`;
    return `${diffDays}gün önce`;
  } catch {
    return 'bilinmiyor';
  }
}

function mapAuditLogToNotification(log: any): NotificationItem {
  let title = 'Sistem Güncellemesi';
  let description = `Aksiyon: ${log.action}`;
  let type: 'alert' | 'success' | 'staff' | 'info' | 'system' = 'info';

  const details = log.details || {};

  switch (log.action) {
    case 'access_requested':
      title = 'Yeni Erişim Talebi 🔐';
      description = `Bir kullanıcı panel erişimi talep etti. Discord ID: ${log.target_id || '—'}`;
      type = 'staff';
      break;
    case 'access_approved':
      title = 'Erişim Onaylandı ✅';
      description = `${log.target_id ? `Discord ID ${log.target_id}` : 'Kullanıcı'} erişim talebi onaylandı. Rütbe: ${details.role || 'Viewer'}`;
      type = 'success';
      break;
    case 'access_rejected':
      title = 'Erişim Reddedildi ❌';
      description = `${log.target_id ? `Discord ID ${log.target_id}` : 'Kullanıcı'} erişim talebi reddedildi.`;
      type = 'alert';
      break;
    case 'warning_added':
    case 'warning_add':
      title = 'Yetkili Uyarısı ⚠️';
      description = `${log.target_id ? `Discord ID ${log.target_id}` : 'Yetkili'} yeni bir uyarı aldı. Puan: ${details.points || 1}`;
      type = 'alert';
      break;
    case 'warning_deleted':
    case 'warning_delete':
      title = 'Yetkili Uyarısı Silindi 🗑️';
      description = `${log.target_id ? `Discord ID ${log.target_id}` : 'Yetkili'} üzerindeki bir uyarı silindi.`;
      type = 'info';
      break;
    case 'lockdown':
      title = '🚨 ACİL DURUM KİLİDİ 🚨';
      description = 'Sunucu acil durum koruması altına alındı ve kanallar kilitlendi!';
      type = 'alert';
      break;
    case 'unlockdown':
      title = '🔓 Acil Durum Kilidi Kaldırıldı';
      description = 'Kanallar tekrar kullanıma açıldı.';
      type = 'success';
      break;
    case 'sync':
    case 'cases_upserted':
      title = 'Veriler Senkronize Edildi 🔄';
      description = `Supabase veritabanı ${details.count || 'bazı'} ceza kaydı ile senkronize edildi.`;
      type = 'success';
      break;
    case 'dispute_replied':
    case 'message_replied':
      title = 'İtiraza Yanıt Verildi ✉️';
      description = `${log.target_id ? `Discord ID ${log.target_id}` : 'Yetkili'} itirazına yönetim tarafından yanıt yazıldı.`;
      type = 'system';
      break;
    default:
      if (log.action.includes('delete')) {
        title = 'Kayıt Silindi';
        description = `${log.action} işlemi gerçekleştirildi.`;
        type = 'alert';
      } else if (log.action.includes('update') || log.action.includes('edit')) {
        title = 'Güncelleme Yapıldı';
        description = `${log.action} işlemi gerçekleştirildi.`;
        type = 'info';
      }
  }

  return {
    id: log.id,
    title,
    description,
    type,
    time: formatRelativeTime(log.created_at),
    unread: true
  };
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchLogs = async () => {
    try {
      const logs = await getAuditLogs(20);
      const clearedIds = JSON.parse(localStorage.getItem('lutheus_cleared_notification_ids') || '[]');
      const readIds = JSON.parse(localStorage.getItem('lutheus_read_notification_ids') || '[]');
      
      const mapped = logs
        .filter((log: any) => !clearedIds.includes(log.id))
        .map((log: any) => {
          const item = mapAuditLogToNotification(log);
          item.unread = !readIds.includes(log.id);
          return item;
        });
      setNotifications(mapped);
    } catch (err) {
      console.error('Failed to fetch notifications from audit logs:', err);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));

    // Poll every 15 seconds
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const markAllAsRead = () => {
    const ids = notifications.map(n => n.id);
    const existingReadIds = JSON.parse(localStorage.getItem('lutheus_read_notification_ids') || '[]');
    const newReadIds = Array.from(new Set([...existingReadIds, ...ids]));
    localStorage.setItem('lutheus_read_notification_ids', JSON.stringify(newReadIds));
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    const ids = notifications.map(n => n.id);
    const existingCleared = JSON.parse(localStorage.getItem('lutheus_cleared_notification_ids') || '[]');
    const newCleared = Array.from(new Set([...existingCleared, ...ids]));
    localStorage.setItem('lutheus_cleared_notification_ids', JSON.stringify(newCleared));
    setNotifications([]);
  };

  const removeNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existingCleared = JSON.parse(localStorage.getItem('lutheus_cleared_notification_ids') || '[]');
    localStorage.setItem('lutheus_cleared_notification_ids', JSON.stringify([...existingCleared, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={15} className="text-[#32D74B]" />;
      case 'alert':
        return <ShieldAlert size={15} className="text-[#FF453A]" />;
      case 'staff':
        return <UserPlus size={15} className="text-[#FF9F0A]" />;
      case 'system':
        return <Zap size={15} className="text-[#5E5CE6]" />;
      default:
        return <Info size={15} className="text-[#0DF5FF]" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 cursor-pointer"
          />

          {/* Toast/Slide-out Panel Container */}
          <motion.div
            initial={{ x: '100%', opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#0A0A0C]/90 border-l border-white/[0.08] backdrop-blur-3xl shadow-[25px_0_60px_-15px_rgba(0,0,0,0.7)] z-50 flex flex-col overflow-hidden text-left"
          >
            {/* Header section */}
            <div className="p-5 border-b border-white/[0.05] bg-black/25 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#5E5CE6]">
                  <Bell size={16} />
                </span>
                <div>
                  <h3 className="text-[14px] font-bold text-white tracking-tight">Bildirim Merkezi</h3>
                  <p className="text-[10px] text-[#8E8E93] font-medium leading-none mt-1">Sistem ve ceza rapor güncellemeleri</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-white/5 border border-transparent hover:border-white/15 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Action controls */}
            {notifications.length > 0 && !loading && (
              <div className="px-5 py-2.5 bg-white/[0.01] border-b border-white/[0.03] flex items-center justify-between text-[11px] font-semibold text-white/50">
                <button
                  onClick={markAllAsRead}
                  className="hover:text-[#5E5CE6] transition-colors cursor-pointer"
                >
                  Tümünü Okundu İşaretle
                </button>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 hover:text-[#FF453A] transition-colors cursor-pointer"
                >
                  <Trash2 size={11} /> Tümünü Temizle
                </button>
              </div>
            )}

            {/* Scrollable list of micro toasts */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 pretty-scrollbar">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                  <span className="text-xs text-white/40 font-semibold">Bildirimler yükleniyor...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 relative">
                  <div className="absolute inset-0 bg-radial-gradient from-[#5e5ce6]/3 via-transparent to-transparent opacity-60 pointer-events-none" />
                  <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 text-white/20">
                    <Bell size={20} />
                  </div>
                  <h4 className="text-[13px] font-bold text-white/80">Her Şey Güncel</h4>
                  <p className="text-[11px] text-white/30 mt-1 max-w-xs leading-relaxed">
                    Şu anda okunmamış bir sistem uyarısı veya ceza güncellemesi bulunmuyor.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 50, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className={`relative overflow-hidden rounded-xl border p-4 backdrop-blur-md transition-all shadow-md group ${
                        n.unread
                          ? 'bg-white/[0.04] border-white/[0.09] shadow-inner'
                          : 'bg-white/[0.01] border-white/[0.03]'
                      }`}
                    >
                      {/* Left side highlight line */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                        n.type === 'success' ? 'bg-[#32D74B]' :
                        n.type === 'alert' ? 'bg-[#FF453A]' :
                        n.type === 'staff' ? 'bg-[#FF9F0A]' :
                        n.type === 'system' ? 'bg-[#5E5CE6]' : 'bg-[#0DF5FF]'
                      }`} />

                      <div className="flex items-start gap-3 pl-1">
                        <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 mt-0.5">
                          {getIcon(n.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-[12.5px] font-bold text-white/95 leading-tight truncate">
                              {n.title}
                            </h4>
                            <span className="text-[9px] font-semibold text-white/30 whitespace-nowrap mt-0.5">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/50 leading-relaxed mt-1 font-medium">
                            {n.description}
                          </p>

                          <div className="flex items-center justify-between mt-2.5">
                            {n.unread ? (
                              <span className="text-[8px] font-mono font-bold text-[#5E5CE6] tracking-wider uppercase bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 px-1.5 py-0.5 rounded">
                                YENİ
                              </span>
                            ) : (
                              <span className="text-[8px] font-mono text-white/20 tracking-wider">OKUNDU</span>
                            )}

                            <button
                              onClick={(e) => removeNotification(n.id, e)}
                              className="text-[10px] text-white/30 hover:text-[#FF453A] transition-colors font-semibold py-0.5 px-1.5 rounded hover:bg-white/5 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Kaldır
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Bottom info panel */}
            <div className="p-4 border-t border-white/[0.05] bg-black/40 text-center text-[10px] font-mono text-[#8E8E93]">
              Lutheus CezaRapor Monitor • Veri Eşitlemesi Aktif
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
