import { useEffect, useState, useMemo } from 'react';
import { Download, Copy, Trophy } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile } from '../lib/supabase';
import { calculatePerformanceScore, getReliabilityStatus } from '../lib/cukEngine';
import { getRoleLabel, getRoleColor } from '../lib/auth';
import { parseDateSafe } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type Period = '7' | '14' | '30' | 'all';

interface PointtrainRow {
  rank: number;
  discordId: string;
  name: string;
  avatar: string;
  role: string;
  sapphireCases: number;
  valid: number;
  invalid: number;
  pending: number;
  accuracy: number;
  score: number;
  reliability: string;
}

function buildRows(cases: SapphireCase[], periodDays: number | null, staffProfiles: StaffProfile[]): PointtrainRow[] {
  const now = Date.now();
  
  // Exclude management roles: 'kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi'
  const managementRoles = new Set(['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi']);
  
  const staffMap = new Map<string, StaffProfile>();
  for (const sp of staffProfiles) {
    staffMap.set(sp.discord_id, sp);
  }

  const filtered = periodDays
    ? cases.filter((c) => now - parseDateSafe(c.created_at_sapphire).getTime() <= periodDays * 86400000)
    : cases;

  const map = new Map<string, Omit<PointtrainRow, 'rank'>>();
  for (const c of filtered) {
    const id = c.author_discord_id;
    
    // Check if the author is management staff
    const profile = staffMap.get(id);
    const roleStr = (profile?.role || 'discord_moderatoru').toLowerCase();
    if (managementRoles.has(roleStr) || roleStr === 'eski_yetkili' || roleStr === 'blocked' || profile?.status === 'INACTIVE') {
      continue;
    }

    if (!map.has(id)) {
      map.set(id, {
        discordId: id,
        name: profile?.username || c.author_display_name || id,
        avatar: profile?.avatar_url || c.author_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
        role: profile?.role || 'discord_moderatoru',
        sapphireCases: 0, valid: 0, invalid: 0, pending: 0,
        accuracy: 0, score: 0, reliability: 'Bekleyen',
      });
    }
    const r = map.get(id)!;
    r.sapphireCases++;
    if (c.cuk_verdict === 'valid') r.valid++;
    else if (c.cuk_verdict === 'invalid') r.invalid++;
    else r.pending++;
  }

  return Array.from(map.values())
    .map((r) => {
      r.accuracy = r.sapphireCases > 0 ? Math.round((r.valid / r.sapphireCases) * 100) : 0;
      r.score = calculatePerformanceScore(r.valid, r.invalid, r.pending);
      r.reliability = getReliabilityStatus(r.valid, r.invalid);
      return r;
    })
    .sort((a, b) => b.score - a.score || b.sapphireCases - a.sapphireCases)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function exportCSV(rows: PointtrainRow[], t: any) {
  const headers = `${t('pt.rank')},${t('home.moderator')},${t('home.total')},${t('pt.valid')},${t('pt.invalid')},${t('pt.pending')},${t('home.accuracy')}%,${t('pt.score')},${t('pt.reliability')}`;
  const lines = rows.map((r) =>
    `${r.rank},"${r.name}",${r.sapphireCases},${r.valid},${r.invalid},${r.pending},${r.accuracy},${r.score},"${r.reliability}"`,
  );
  const csv = [headers, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lutheus_pointtrain_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown(rows: PointtrainRow[], t: any): string {
  const lines = rows.map((r) =>
    `${r.rank}. **${r.name}** — ${t('home.total')}: ${r.sapphireCases} | ${t('pt.valid')}: ${r.valid} | ${t('pt.invalid')}: ${r.invalid} | %${r.accuracy} | ${t('pt.score')}: ${r.score}`,
  );
  return `**Lutheus Pointtrain Report**\n${'━'.repeat(30)}\n${lines.join('\n')}`;
}

export default function Pointtrain() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('7');

  const isMgmtOrSenior = session
    ? ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(session.role?.toLowerCase())
    : false;

  const loadData = () => {
    setLoading(true);
    Promise.all([getCases(1000), getStaffProfiles()])
      .then(([casesData, staffData]) => {
        setCases(casesData);
        setStaffProfiles(staffData);
      })
      .catch((err) => {
        console.error(err);
        showToast('Veriler yuklenirken hata olustu', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const periodDays = period === 'all' ? null : Number(period);
  const rows = useMemo(() => buildRows(cases, periodDays, staffProfiles), [cases, period, staffProfiles]);

  const totalValid = rows.reduce((s, r) => s + r.valid, 0);
  const totalInvalid = rows.reduce((s, r) => s + r.invalid, 0);
  const totalCases = rows.reduce((s, r) => s + r.sapphireCases, 0);
  const avgAccuracy = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.accuracy, 0) / rows.length) : 0;

  const copyMarkdown = () => {
    navigator.clipboard.writeText(exportMarkdown(rows, t))
      .then(() => {
        showToast('Rapor panoya kopyalandi', 'success');
      })
      .catch(() => {
        showToast('Kopyalama basarisiz', 'error');
      });
  };

  const handleExportCSV = () => {
    exportCSV(rows, t);
    showToast('CSV indiriliyor', 'success');
  };

  const reliabilityVariant = (r: string): any =>
    r === 'Guvenilir' ? 'success' : r === 'Riskli' ? 'destructive' : 'warning';

  return (
    <div className="space-y-5 animate-in pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('pt.title')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('pt.subtitle').replace('{rows}', String(rows.length)).replace('{total}', String(totalCases))}
          </p>
        </div>
         <div className="flex gap-2">
          {isMgmtOrSenior && (
            <>
              <Button variant="ghost" size="sm" onClick={copyMarkdown} disabled={loading}>
                <Copy className="w-3.5 h-3.5" /> {t('pt.copyDiscord')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
                <Download className="w-3.5 h-3.5" /> {t('pt.csv')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('home.statTotal'), val: totalCases, color: 'text-foreground' },
          { label: t('pt.valid'), val: totalValid, color: 'text-emerald-400' },
          { label: t('pt.invalid'), val: totalInvalid, color: 'text-destructive' },
          { label: t('pt.avgAccuracy'), val: `%${avgAccuracy}`, color: avgAccuracy >= 90 ? 'text-emerald-400' : avgAccuracy >= 75 ? 'text-amber-400' : 'text-destructive' },
        ].map(({ label, val, color }) => (
          <Card key={label} className="p-4 text-center">
            {loading ? (
              <Skeleton className="h-7 w-12 mx-auto mb-1" />
            ) : (
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
            )}
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2.5">
        {([['7', t('pt.period7')], ['14', t('pt.period14')], ['30', t('pt.period30')], ['all', t('pt.periodAll')]] as [Period, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => {
              setPeriod(val);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 border-2 ${
              period === val 
                ? 'bg-primary/10 text-primary border-primary shadow-[0_0_12px_rgba(124,58,237,0.25)] scale-105' 
                : 'bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary/80 hover:text-foreground hover:border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="py-3 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.rank')}</th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.moderator')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.total')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.valid')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.invalid')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.accuracy')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.score')}</th>
                <th className="py-3 px-4 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.reliability')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-4" /></td>
                    <td className="py-3 px-3"><div className="flex items-center gap-2"><Skeleton className="w-8 h-8 rounded-full" /><Skeleton className="h-4 w-24" /></div></td>
                    <td colSpan={6} />
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<Trophy className="w-6 h-6" />} title={t('home.noData')} description="" /></td></tr>
              ) : rows.map((r) => (
                <tr key={r.discordId} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`font-bold text-xs ${r.rank === 1 ? 'text-amber-400' : r.rank === 2 ? 'text-slate-400' : r.rank === 3 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                      {r.rank}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <img src={r.avatar} alt="" className="w-8 h-8 rounded-full bg-secondary" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold" style={{ color: getRoleColor(r.role) }}>
                          {getRoleLabel(r.role)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-foreground">{r.sapphireCases}</td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-semibold">{r.valid}</td>
                  <td className="py-3 px-3 text-center text-destructive font-semibold">{r.invalid}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-bold text-sm ${r.accuracy >= 95 ? 'text-emerald-400' : r.accuracy >= 80 ? 'text-amber-400' : 'text-destructive'}`}>
                      %{r.accuracy}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-sm font-bold text-primary">{r.score}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={reliabilityVariant(r.reliability)}>{r.reliability}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
