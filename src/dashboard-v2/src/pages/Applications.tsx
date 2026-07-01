import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, X, User, Shield, Info, Filter, RefreshCw, AlertTriangle, Link2, Download
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
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

function getStatusClasses(status: string) {
  const norm = (status || '').toLowerCase();
  if (norm.includes('yeni')) {
    return {
      bg: 'bg-blue-500/10 border-blue-500/20',
      text: 'text-blue-400',
      dot: 'bg-blue-500'
    };
  }
  if (norm.includes('incele')) {
    return {
      bg: 'bg-amber-500/10 border-amber-500/20',
      text: 'text-amber-400',
      dot: 'bg-amber-500'
    };
  }
  if (norm.includes('spam')) {
    return {
      bg: 'bg-orange-500/10 border-orange-500/20',
      text: 'text-orange-400',
      dot: 'bg-orange-500'
    };
  }
  if (norm.includes('blacklist') || norm.includes('kara')) {
    return {
      bg: 'bg-red-500/10 border-red-500/20',
      text: 'text-red-400',
      dot: 'bg-red-500'
    };
  }
  if (norm.includes('basarili') || norm.includes('onay')) {
    return {
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500'
    };
  }
  if (norm.includes('basarisiz') || norm.includes('red')) {
    return {
      bg: 'bg-rose-500/10 border-rose-500/20',
      text: 'text-rose-400',
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
  const [apps, setApps] = useState<StaffApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<StaffApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sheet sync states
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('lutheus-sync-sheet-url') || '');
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [showSyncConfig, setShowSyncConfig] = useState(false);

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
  }, []);

  const stats = useMemo(() => {
    const total = apps.length;
    const activeNew = apps.filter(a => (a.status || '').toLowerCase().includes('yeni')).length;
    const reviewing = apps.filter(a => (a.status || '').toLowerCase().includes('incele')).length;
    const spam = apps.filter(a => (a.status || '').toLowerCase().includes('spam')).length;
    const blacklist = apps.filter(a => (a.status || '').toLowerCase().includes('blacklist')).length;
    return { total, activeNew, reviewing, spam, blacklist };
  }, [apps]);

  const filteredApps = useMemo(() => {
    return apps.filter(a => {
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'new' && (a.status || '').toLowerCase().includes('yeni')) ||
        (statusFilter === 'reviewing' && (a.status || '').toLowerCase().includes('incele')) ||
        (statusFilter === 'spam' && (a.status || '').toLowerCase().includes('spam')) ||
        (statusFilter === 'blacklist' && (a.status || '').toLowerCase().includes('blacklist')) ||
        (statusFilter === 'successful' && (a.status || '').toLowerCase().includes('basarili')) ||
        (statusFilter === 'failed' && (a.status || '').toLowerCase().includes('basarisiz'));

      const searchLower = searchQuery.toLowerCase();
      const matchSearch = !searchQuery || 
        (a.applicant_id || '').toLowerCase().includes(searchLower) ||
        (a.full_name || '').toLowerCase().includes(searchLower) ||
        (a.discord_tag || '').toLowerCase().includes(searchLower) ||
        (a.email || '').toLowerCase().includes(searchLower);

      return matchStatus && matchSearch;
    });
  }, [apps, statusFilter, searchQuery]);

  const handleStatusUpdate = async (applicantId: string, newStatus: string) => {
    setUpdatingId(applicantId);
    try {
      await updateStaffApplicationStatus(applicantId, newStatus);
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

  // Google Sheets Direct Sync Logic (Bypasses Google Apps Script network issues)
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
    const spreadsheetId = matches[1];
    localStorage.setItem('lutheus-sync-sheet-url', sheetUrl);

    setSyncingSheet(true);
    let totalSynced = 0;

    const sheetsToSync = [
      { name: "Başvurular", defaultStatus: "Yeni Başvuru" },
      { name: "Spam", defaultStatus: "Spam" },
      { name: "BlackList", defaultStatus: "BlackList" },
      { name: "Arşiv", defaultStatus: "Arşiv" }
    ];

    try {
      for (const s of sheetsToSync) {
        // Query as CSV format directly via Google Visualization API
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(s.name)}`;
        const response = await fetch(csvUrl);
        if (!response.ok) {
          console.warn(`Could not sync sheet ${s.name}, checking next...`);
          continue;
        }
        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length <= 1) continue;

        const records = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const id = row[0];
          const status = row[1] || s.defaultStatus;
          const dateStr = row[2];
          const email = row[3];
          const fullName = row[4];
          const discordTag = row[6];

          if (!id || !email) continue;

          // Align with sheet column settings
          const rawAnswers = {
            id: id,
            email: email,
            fullName: fullName,
            birthDate: row[5],
            discordInfo: discordTag,
            discordUsage: row[7],
            penaltyHistory: row[8],
            micQuality: row[9],
            motivation: row[10],
            teamwork: row[11],
            moderationPurpose: row[12],
            experience: row[13],
            regret: row[14],
            availability: row[15],
            timeWindows: row[16]
          };

          records.push({
            applicant_id: id,
            status: status,
            form_type: 'application',
            full_name: fullName || null,
            discord_tag: discordTag || null,
            email: email || null,
            raw_answers: rawAnswers,
            created_at: parseSheetDate(dateStr)
          });
        }

        // Direct upsert to Supabase
        for (const record of records) {
          await upsertStaffApplication(record);
          totalSynced++;
        }
      }

      showToast(`${totalSynced} başvuru başarıyla Google Tablosundan çekilerek senkronize edildi!`, 'success');
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
    <div className="space-y-6">
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
                  E-Tablo Verilerini Çek
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
                  Google Apps Script yetkilendirme sorunlarını atlatmak için verileri doğrudan tarayıcınız üzerinden Google E-Tablonuzdan çekebilirsiniz.
                </p>
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-400 flex gap-2">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block mb-0.5">Önemli Gereksinim:</strong>
                    Google E-Tablonuzda sağ üstteki **Paylaş** butonuna basın ve Genel Erişim ayarını **"Bağlantıya sahip olan herkes görüntüleyebilir"** olarak değiştirin.
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

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed top-0 right-0 h-full w-full max-w-[550px] bg-[#0D0D11] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/[0.04] bg-[#0D0D11]/90 backdrop-blur flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
                    <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] font-bold uppercase">Başvuru Bilgisi</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {selectedApp.full_name || 'Bilinmeyen Aday'} ({selectedApp.applicant_id})
                  </h3>
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
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${getStatusClasses(selectedApp.status).bg} ${getStatusClasses(selectedApp.status).bg.replace('border-', '')}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${getStatusClasses(selectedApp.status).dot}`} />
                    <div>
                      <div className={`text-xs font-bold ${getStatusClasses(selectedApp.status).text}`}>
                        {selectedApp.status}
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
                          className="h-6 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/80 font-bold hover:text-white border border-white/[0.04] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {st === 'İnceleniyor' ? 'Mülakata Al' : st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Candidate Overview Fields */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Discord Bilgisi</div>
                    <div className="text-xs font-semibold text-white mt-1 flex items-center gap-1.5">
                      <User size={12} className="text-white/40" />
                      {selectedApp.discord_tag}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Doğum Tarihi</div>
                    <div className="text-xs font-semibold text-white mt-1">
                      {selectedApp.raw_answers?.birthDate || 'Belirtilmemiş'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Mikrofon Kalitesi</div>
                    <div className="text-xs font-semibold text-white mt-1">
                      {selectedApp.raw_answers?.micQuality || 'Belirtilmemiş'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Kullanım Süresi</div>
                    <div className="text-xs font-semibold text-white mt-1">
                      {selectedApp.raw_answers?.discordUsage || 'Belirtilmemiş'}
                    </div>
                  </div>
                </div>

                {/* Candidate Detailed Answers */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-1.5">
                    <Shield size={13} className="text-primary" />
                    Form Detayları
                  </h4>

                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="font-bold text-white/40 mb-1">Neden yetkili ekibimize katılmak istiyorsunuz? (Motivasyon)</div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/80 leading-relaxed whitespace-pre-line">
                        {selectedApp.raw_answers?.motivation || 'Belirtilmemiş'}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-white/40 mb-1">Ekip çalışmasına nasıl katkıda bulunabilirsiniz?</div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/80 leading-relaxed whitespace-pre-line">
                        {selectedApp.raw_answers?.teamwork || 'Belirtilmemiş'}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-white/40 mb-1">Daha önce ceza geçmişiniz oldu mu? Olduysa detayları nelerdir?</div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/80 leading-relaxed whitespace-pre-line">
                        {selectedApp.raw_answers?.penaltyHistory || 'Belirtilmemiş'}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-white/40 mb-1">Daha önceki moderasyon deneyimleriniz nelerdir?</div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/80 leading-relaxed whitespace-pre-line">
                        {selectedApp.raw_answers?.experience || 'Belirtilmemiş'}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-white/40 mb-1">Geçmişte aldığınız ama pişman olduğunuz bir karar var mı?</div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/80 leading-relaxed whitespace-pre-line">
                        {selectedApp.raw_answers?.regret || 'Belirtilmemiş'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-bold text-white/40 mb-1">Haftalık Aktiflik Süresi</div>
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/85">
                          {selectedApp.raw_answers?.availability || 'Belirtilmemiş'}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-white/40 mb-1">Müsait Zaman Aralıkları</div>
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/85">
                          {selectedApp.raw_answers?.timeWindows || 'Belirtilmemiş'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
