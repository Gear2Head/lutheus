import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, X, User, Shield, Info, Filter, RefreshCw, AlertTriangle, Link2, Download, Copy
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { getStaffApplications, updateStaffApplicationStatus, StaffApplication, supabaseFetch, upsertStaffApplication } from '../lib/supabase';
import { formatDate } from '../lib/utils';

// Metric Card Component
function StatCard({
  label, value, icon: Icon, color
}: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-secondary/10 border border-white/[0.05] flex flex-col gap-2 transition-all hover:border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={14} />
        </div>
      </div>
      <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
    </div>
  );
}

function normalizeTurkish(str: string): string {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getStatusClasses(status: string) {
  const norm = normalizeTurkish(status || '');
  
  if (norm.includes('yeni')) {
    return {
      bg: 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500/30',
      text: 'text-blue-400 font-semibold',
      dot: 'bg-blue-400'
    };
  }
  if (norm.includes('incele')) {
    return {
      bg: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border-purple-500/30',
      text: 'text-purple-400 font-semibold',
      dot: 'bg-[#A259FE]'
    };
  }
  if (norm.includes('spam')) {
    return {
      bg: 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/30',
      text: 'text-orange-400 font-semibold',
      dot: 'bg-orange-500'
    };
  }
  if (norm.includes('blacklist') || norm.includes('kara') || norm.includes('reddedildi')) {
    return {
      bg: 'blacklist-shimmer border-zinc-800/80',
      text: 'text-zinc-300 font-bold',
      dot: 'bg-zinc-400'
    };
  }
  if (norm.includes('basarili') || norm.includes('onay')) {
    return {
      bg: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
      text: 'text-emerald-400 font-semibold',
      dot: 'bg-emerald-400'
    };
  }
  if (norm.includes('basarisiz') || norm.includes('red')) {
    return {
      bg: 'bg-gradient-to-r from-rose-500/20 to-red-500/20 border-rose-500/30',
      text: 'text-rose-400 font-semibold',
      dot: 'bg-rose-500'
    };
  }
  return {
    bg: 'bg-white/5 border-white/[0.08]',
    text: 'text-white/60',
    dot: 'bg-white/30'
  };
}

export default function Applications() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const [apps, setApps] = useState<StaffApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<StaffApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sheet sync states
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('lutheus-sync-sheet-url') || '');
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('lutheus-google-script-url') || '');
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [showSyncConfig, setShowSyncConfig] = useState(false);
  const [formConfig, setFormConfig] = useState<any>(null);

  const fetchFormConfig = async () => {
    try {
      const data = await supabaseFetch<any[]>('custom_forms', 'GET', 'id=eq.yetkili_alim');
      if (data && data[0]) {
        setFormConfig(data[0]);
      }
    } catch (e) {
      console.warn('Failed to load formConfig in Applications.tsx:', e);
    }
  };


  const fetchApps = async () => {
    setLoading(true);
    try {
      const data = await getStaffApplications();
      setApps(data);
    } catch (err) {
      showToast('Başvurular yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchFormConfig();
  }, []);


  const stats = useMemo(() => {
    const total = apps.length;
    const activeNew = apps.filter(a => {
      const s = a.status || '';
      return normalizeTurkish(s).includes('yeni') || s === 'Yeni Başvuru';
    }).length;
    const reviewing = apps.filter(a => {
      const s = a.status || '';
      return normalizeTurkish(s).includes('incele') || s === 'İnceleniyor';
    }).length;
    const spam = apps.filter(a => {
      const s = a.status || '';
      return normalizeTurkish(s).includes('spam') || s === 'Spam';
    }).length;
    const blacklist = apps.filter(a => {
      const s = a.status || '';
      return normalizeTurkish(s).includes('blacklist') || normalizeTurkish(s).includes('kara') || normalizeTurkish(s).includes('reddedildi') || s === 'BlackList';
    }).length;
    return { total, activeNew, reviewing, spam, blacklist };
  }, [apps]);

  const filteredApps = useMemo(() => {
    return apps.filter(a => {
      const rawStatus = a.status || '';
      const normStatus = normalizeTurkish(rawStatus);
      const isNew = normStatus.includes('yeni') || rawStatus === 'Yeni Başvuru';
      const isReviewing = normStatus.includes('incele') || rawStatus === 'İnceleniyor';
      const isSpam = normStatus.includes('spam') || rawStatus === 'Spam';
      const isBlacklist = normStatus.includes('blacklist') || normStatus.includes('kara') || rawStatus === 'BlackList';
      const isSuccessful = normStatus.includes('basarili') || normStatus.includes('onay') || rawStatus === 'Başarılı';
      const isFailed = normStatus.includes('basarisiz') || normStatus.includes('red') || rawStatus === 'Başarısız';

      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'new' && isNew) ||
        (statusFilter === 'reviewing' && isReviewing) ||
        (statusFilter === 'spam' && isSpam) ||
        (statusFilter === 'blacklist' && isBlacklist) ||
        (statusFilter === 'successful' && isSuccessful) ||
        (statusFilter === 'failed' && isFailed);

      const searchNorm = normalizeTurkish(searchQuery);
      const matchSearch = !searchQuery || 
        normalizeTurkish(a.applicant_id).includes(searchNorm) ||
        normalizeTurkish(a.full_name).includes(searchNorm) ||
        normalizeTurkish(a.discord_tag).includes(searchNorm) ||
        normalizeTurkish(a.email).includes(searchNorm);

      return matchStatus && matchSearch;
    });
  }, [apps, statusFilter, searchQuery]);

  const handleStatusUpdate = async (applicantId: string, newStatus: string) => {
    setUpdatingId(applicantId);
    try {
      const executorName = session?.profile?.displayName || session?.profile?.username || 'Web Panel';
      await updateStaffApplicationStatus(applicantId, newStatus, executorName);
      
      // Trigger Discord notification via Apps Script
      const scriptUrl = localStorage.getItem('lutheus-google-script-url');
      if (scriptUrl) {
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateStatus',
            applicantId,
            status: newStatus,
            executorName
          })
        }).catch(err => console.warn('Discord webhook notification failed:', err));
      }

      showToast(`Başvuru durumu başarıyla güncellendi: ${newStatus}`, 'success');
      
      setApps(prev => prev.map(a => a.applicant_id === applicantId ? { ...a, status: newStatus } : a));
      if (selectedApp && selectedApp.applicant_id === applicantId) {
        setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      showToast('Durum güncellenirken hata oluştu', 'error');
    } finally {
      setUpdatingId(null);
    }
  };


  const handleDeleteApplication = async (applicantId: string) => {
    if (!window.confirm('Bu başvuruyu veritabanından tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    setUpdatingId(applicantId);
    try {
      await supabaseFetch('staff_applications', 'DELETE', `applicant_id=eq.${applicantId}`);
      showToast('Başvuru veritabanından kalıcı olarak silindi.', 'success');
      setApps(prev => prev.filter(a => a.applicant_id !== applicantId));
      setSelectedApp(null);
    } catch (err: any) {
      showToast(`Silme hatası: ${err.message || String(err)}`, 'error');
    } finally {
      setUpdatingId(null);
    }
  };


  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} kopyalandı!`, 'success');
  };

  const extractDiscordId = (tag: string): string => {
    if (!tag) return '';
    const match = tag.match(/\d{17,20}/);
    return match ? match[0] : tag;
  };

  // Google Sheets Sync Logic via Next.js Backend (Avoids CORS issues)
  const handleSheetSync = async () => {
    if (!sheetUrl) {
      showToast('Lütfen geçerli bir Google Tablosu linki girin', 'error');
      return;
    }

    const matches = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches) {
      showToast('Geçersiz Google Sheet bağlantısı formatı', 'error');
      return;
    }
    localStorage.setItem('lutheus-sync-sheet-url', sheetUrl);
    localStorage.setItem('lutheus-google-script-url', scriptUrl);

    setSyncingSheet(true);

    try {
      const response = await fetch('https://lutheus.vercel.app/api/forms/sync-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sheetUrl })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      showToast(`${result.totalSynced} başvuru başarıyla Google Tablosundan çekilerek senkronize edildi!`, 'success');
      setShowSyncConfig(false);
      fetchApps();
    } catch (err: any) {
      showToast('Eşitleme sırasında hata oluştu. Tablo paylaşım ayarlarını ("Bağlantıya sahip olan herkes görüntüleyebilir") kontrol edin.', 'error');
      console.error(err);
    } finally {
      setSyncingSheet(false);
    }
  };

  // Helper CSV parser
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentField = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentField.trim());
        lines.push(row);
        row = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (row.length > 0 || currentField) {
      row.push(currentField.trim());
      lines.push(row);
    }
    return lines;
  };

  const parseSheetDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString();
    try {
      const parts = dateStr.split(' ');
      if (parts.length < 2) return new Date().toISOString();
      const dParts = parts[0].split('.');
      const tParts = parts[1].split(':');
      if (dParts.length < 3 || tParts.length < 2) return new Date().toISOString();
      
      const date = new Date(
        parseInt(dParts[2], 10),
        parseInt(dParts[1], 10) - 1,
        parseInt(dParts[0], 10),
        parseInt(tParts[0], 10),
        parseInt(tParts[1], 10),
        tParts[2] ? parseInt(tParts[2], 10) : 0
      );
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 md:p-8 w-full space-y-6 md:space-y-8 select-none text-left"
    >
      <style>{`
        @keyframes blacklist-glimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .blacklist-shimmer {
          background: linear-gradient(120deg, #020202 30%, #1e1e24 50%, #020202 70%) !important;
          background-size: 200% 100% !important;
          animation: blacklist-glimmer 2.5s infinite linear !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="text-primary w-5 h-5" />
            Başvuru Yönetimi
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Yetkili alım formu üzerinden gelen tüm müracaatları buradan izleyin ve yönetin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSyncConfig(true)}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary hover:text-white transition-all text-xs font-semibold cursor-pointer shrink-0"
          >
            <Link2 size={13} />
            E-Tablo ile Eşitle
          </button>
          <button
            onClick={fetchApps}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/[0.06] transition-all text-xs font-semibold cursor-pointer shrink-0"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Yenile
          </button>
        </div>
      </div>

      {/* Sync Google Sheets Configuration Overlay */}
      <AnimatePresence>
        {showSyncConfig && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowSyncConfig(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0D0D11]/95 border border-white/[0.08] rounded-2xl p-5 shadow-2xl z-50 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Download size={15} className="text-primary" />
                  İki Yönlü E-Tablo Eşitleme
                </h3>
                <button
                  onClick={() => setShowSyncConfig(false)}
                  className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-white/70">
                <p>
                  E-Tablo verilerini Vercel sunucumuz üzerinden çekerek CORS engellerini tamamen aşabilirsiniz.
                </p>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-400 flex gap-2">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block mb-0.5">1. Okuma İzni (Zorunlu):</strong>
                    E-Tablonuzda sağ üstteki **Paylaş** butonuna basın ve Genel Erişim ayarını **"Bağlantıya sahip olan herkes görüntüleyebilir"** yapın.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">E-Tablo Bağlantı Linki</label>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-primary/40"
                  />
                </div>

                <div className="border-t border-white/[0.04] pt-3.5 space-y-3">
                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-blue-400 flex gap-2">
                    <Shield size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block mb-0.5">2. Geri Yazma İzni (Opsiyonel):</strong>
                      Siteden veya eklentiden onay/ret/spam durumunu değiştirdiğinizde tablonuzun da otomatik güncellenmesini istiyorsanız, Apps Script projenizi **Web Uygulaması** olarak dağıtıp URL'sini buraya yapıştırın.
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Apps Script Web Uygulama URL'si</label>
                    <input
                      type="text"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={scriptUrl}
                      onChange={(e) => setScriptUrl(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-primary/40"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                <button
                  onClick={() => setShowSyncConfig(false)}
                  className="h-8.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/60 font-semibold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  disabled={syncingSheet}
                  onClick={handleSheetSync}
                  className="h-8.5 px-4 rounded-xl bg-primary hover:bg-primary/95 text-xs text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {syncingSheet ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Eşitleniyor...
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      Şimdi Eşitle
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Toplam Başvuru" value={stats.total} icon={FileText} color="bg-primary/10 text-primary" />
        <StatCard label="Yeni Gelenler" value={stats.activeNew} icon={Clock} color="bg-blue-500/10 text-blue-400" />
        <StatCard label="İncelemedekiler" value={stats.reviewing} icon={Info} color="bg-amber-500/10 text-amber-400" />
        <StatCard label="Spam Kategori" value={stats.spam} icon={AlertTriangle} color="bg-orange-500/10 text-orange-400" />
        <StatCard label="Kara Liste" value={stats.blacklist} icon={XCircle} color="bg-red-500/10 text-red-400" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3.5 rounded-2xl bg-secondary/5 border border-white/[0.05]">
        <div className="flex flex-wrap gap-1.5 items-center w-full sm:w-auto">
          {[
            { value: 'all', label: 'Tümü' },
            { value: 'new', label: 'Yeni' },
            { value: 'reviewing', label: 'İnceleniyor' },
            { value: 'successful', label: 'Başarılı' },
            { value: 'failed', label: 'Başarısız' },
            { value: 'spam', label: 'Spam' },
            { value: 'blacklist', label: 'BlackList' }
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`h-7 px-3 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                statusFilter === f.value
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <input
            type="text"
            placeholder="LID, İsim veya Discord ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8.5 pl-8.5 pr-4 rounded-xl bg-white/5 hover:bg-white/10 focus:bg-[#0D0D11]/60 border border-white/[0.06] focus:border-primary/40 text-white placeholder-white/30 text-xs transition-all outline-none"
          />
          <span className="absolute left-3 top-2.5 text-white/30">
            <Filter size={13} />
          </span>
        </div>
      </div>

      {/* Applications List */}
      <div className="rounded-2xl border border-white/[0.05] overflow-hidden bg-black/20 backdrop-blur-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.01] text-[10px] uppercase font-bold text-white/40 tracking-wider">
                <th className="px-5 py-3.5">Başvuru ID</th>
                <th className="px-5 py-3.5">Aday Adı</th>
                <th className="px-5 py-3.5">Discord ID / Tag</th>
                <th className="px-5 py-3.5">E-posta</th>
                <th className="px-5 py-3.5 text-center">Durum</th>
                <th className="px-5 py-3.5 text-right">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white/40">
                    <Loader2 className="animate-spin mx-auto w-6 h-6 text-primary mb-2" />
                    Başvurular yükleniyor...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white/40">
                    Eşleşen başvuru kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredApps.map(a => {
                  const sc = getStatusClasses(a.status);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedApp(a)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5 font-mono font-semibold text-white/80 group-hover:text-primary transition-colors">
                        {a.applicant_id}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {a.full_name || 'Belirtilmemiş'}
                      </td>
                      <td className="px-5 py-3.5 text-white/70">
                        {a.discord_tag}
                      </td>
                      <td className="px-5 py-3.5 text-white/60">
                        {a.email}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {a.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-white/40">
                        {formatDate(a.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Drawer */}
      <AnimatePresence>
        {selectedApp && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSelectedApp(null)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed top-0 right-0 h-full w-full max-w-[550px] bg-[#0D0D11] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-white/[0.04] bg-[#0D0D11]/90 backdrop-blur flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
                    <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] font-bold uppercase">Başvuru Bilgisi</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h3 className="text-base font-bold text-white">
                      {selectedApp.full_name || 'Bilinmeyen Aday'}
                    </h3>
                    <span className="text-xs font-mono text-white/40">({selectedApp.applicant_id})</span>
                    <button
                      onClick={() => copyToClipboard(selectedApp.applicant_id, 'Başvuru ID')}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                      title="Başvuru ID Kopyala"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 hide-scrollbar">
                {/* Status card */}
                <div className={`p-4.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${getStatusClasses(selectedApp.status).bg} border-white/[0.08]`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusClasses(selectedApp.status).dot} shadow-lg`} />
                    <div>
                      <div className={`text-xs font-bold ${getStatusClasses(selectedApp.status).text}`}>
                        Durum: {selectedApp.status}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        Başvuru kayıt tarihi: {formatDate(selectedApp.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Actions to update status */}
                  <div className="flex flex-wrap gap-1.5">
                    {['İnceleniyor', 'Başarılı', 'Başarısız', 'Spam', 'BlackList'].map(st => {
                      if (selectedApp.status === st) return null;
                      return (
                        <button
                          key={st}
                          disabled={updatingId === selectedApp.applicant_id}
                          onClick={() => handleStatusUpdate(selectedApp.applicant_id, st)}
                          className="h-7 px-3.5 rounded-xl bg-white/[0.04] hover:bg-purple-600 border border-white/[0.06] hover:border-purple-500/30 text-[10px] text-white font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {st === 'İnceleniyor' ? 'Mülakata Al' : st}
                        </button>
                      );
                    })}

                    <button
                      disabled={updatingId === selectedApp.applicant_id}
                      onClick={() => handleDeleteApplication(selectedApp.applicant_id)}
                      className="h-7 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-600 text-[10px] text-rose-400 hover:text-white font-bold transition-all cursor-pointer active:scale-97 disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>


                {/* Candidate Overview Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest font-mono">Discord Bağlantısı</div>
                      <div className="text-xs font-bold text-white mt-1.5 flex items-center gap-1.5 truncate">
                        <User size={13} className="text-purple-400 shrink-0" />
                        <span className="truncate">@{selectedApp.discord_tag}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(selectedApp.discord_tag || '', 'Discord Tag')}
                        className="flex items-center gap-1 h-6 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-semibold text-white/60 hover:text-white transition-all cursor-pointer"
                      >
                        <Copy size={9} /> Kullanıcı Adı
                      </button>
                      {extractDiscordId(selectedApp.discord_tag || '') && extractDiscordId(selectedApp.discord_tag || '') !== selectedApp.discord_tag && (
                        <button
                          onClick={() => copyToClipboard(extractDiscordId(selectedApp.discord_tag || ''), 'Discord ID')}
                          className="flex items-center gap-1 h-6 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-semibold text-white/60 hover:text-white transition-all cursor-pointer"
                        >
                          <Copy size={9} /> ID
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest font-mono">Aday Adı & Soyadı</div>
                      <div className="text-xs font-bold text-white mt-1.5 truncate">
                        {selectedApp.full_name || 'Belirtilmemiş'}
                      </div>
                    </div>
                    {selectedApp.full_name && (
                      <div className="flex">
                        <button
                          onClick={() => copyToClipboard(selectedApp.full_name || '', 'Aday Adı')}
                          className="flex items-center gap-1 h-6 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-semibold text-white/60 hover:text-white transition-all cursor-pointer"
                        >
                          <Copy size={9} /> İsmi Kopyala
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic or Static Answers */}
                <div className="pt-2">
                  {(() => {
                    const answersObj = selectedApp.raw_answers || {};
                    const isDynamic = Object.keys(answersObj).some(k => k.startsWith('field_'));

                    if (isDynamic && formConfig) {
                      return (
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
                            <Shield size={13} className="text-purple-400" />
                            Adayın Cevap Listesi (Dinamik)
                          </h4>
                          <div className="space-y-3">
                            {formConfig.fields.map((field: any) => {
                              if (field.type === 'section_break') {
                                return (
                                  <div key={field.id} className="pt-3 border-t border-white/[0.04]">
                                    <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{field.label}</div>
                                    {field.help_text && <p className="text-[9px] text-white/30 mt-0.5">{field.help_text}</p>}
                                  </div>
                                );
                              }
                              if (field.type === 'rich_text') {
                                return (
                                  <div key={field.id} className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.02] text-white/50 text-[10px]"
                                    dangerouslySetInnerHTML={{ __html: field.content || '' }} />
                                );
                              }
                              
                              const val = answersObj[field.id];
                              const renderVal = Array.isArray(val) ? val.join(', ') : String(val ?? 'Belirtilmemiş');

                              return (
                                <div key={field.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 hover:border-white/[0.08] transition-all space-y-1.5">
                                  <div className="text-[11px] font-bold text-white/50" dangerouslySetInnerHTML={{ __html: field.label }} />
                                  <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                                    {renderVal}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Fallback to static answers for legacy applications
                    return (
                      <div className="space-y-3 text-xs">
                        <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
                          <Shield size={13} className="text-purple-400" />
                          Adayın Cevap Listesi (Eski Şablon)
                        </h4>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Neden yetkili ekibimize katılmak istiyorsunuz? (Motivasyon)</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.motivation || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Ekip çalışmasına nasıl katkıda bulunabilirsiniz?</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.teamwork || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Daha önce ceza geçmişiniz oldu mu? Olduysa detayları nelerdir?</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.penaltyHistory || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Daha önceki moderasyon deneyimleriniz nelerdir?</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.experience || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Geçmişte aldığınız ama pişman olduğunuz bir karar var mı?</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.regret || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                            <div className="font-bold text-white/50">Haftalık Aktiflik Süresi</div>
                            <div className="text-xs font-semibold text-white/80">
                              {answersObj.availability || 'Belirtilmemiş'}
                            </div>
                          </div>
                          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                            <div className="font-bold text-white/50">Müsait Zaman Aralıkları</div>
                            <div className="text-xs font-semibold text-white/80">
                              {answersObj.timeWindows || 'Belirtilmemiş'}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Yeni gelen bir üyenin sunucuya ilk adım attığında gördüğü yetkili profili sizce nasıl olmalıdır?</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.newMemberProfile || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Stresli veya yoğun dönemlerde nasıl bir iletişim tarzı benimsersiniz?</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.stressCommunication || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/[0.04] pb-2 pt-4">
                          <Shield size={13} className="text-purple-400" />
                          Senaryo ve Durum Analizleri (Eski)
                        </h4>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Genel Sohbette Tartışmalı/Hassas Konu Yönetimi</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.chatControversy || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Aşırı Gergin Kullanıcıya Karşı Yaklaşım</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.tenseUserScenario || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Minecraft Sunucusu Genel Sohbet Senaryosu</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.minecraftScenario || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Asla Müsamaha Gösterilmeyecek İlk 3 Davranış</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.unacceptableBehaviors || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Son Olarak Eklemek İstenenler</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.additionalInfo || 'Belirtilmemiş'}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] border-l-4 border-l-purple-600 space-y-1.5">
                          <div className="font-bold text-white/50">Başvuru Bilgilendirmesi & Onay</div>
                          <div className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-line">
                            {answersObj.infoConsent || 'Belirtilmemiş'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

