import { useEffect, useState } from 'react';
import { Users, Gavel, CheckCircle2, XCircle, TrendingUp, RefreshCw, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile } from '../lib/supabase';
import { getReliabilityStatus } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { resolveStaffAvatar, resolveStaffName } from '../lib/staffDisplay';
import { useLanguage } from '../contexts/LanguageContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface StaffStat {
  discordId: string;
  name: string;
  avatar: string;
  role: string;
  total: number;
  valid: number;
  invalid: number;
  pending: number;
  accuracy: number;
  trend: number[];
}

// SECTION: STAFF_STAT_NORMALIZATION
// PURPOSE: Case verisindeki gerÃ§ek yetkili adlarÄ±nÄ± generic profil fallback deÄŸerlerine tercih eder.
function buildStaffStats(cases: SapphireCase[], staffProfiles: StaffProfile[], t: any): StaffStat[] {
  const map = new Map<string, StaffStat>();
  const staffMap = new Map(staffProfiles.map(s => [s.discord_id, s]));

  for (const c of cases) {
    const id = c.author_discord_id;
    if (!map.has(id)) {
      const profile = staffMap.get(id);
      const role = profile?.role || 'discord_moderatoru';

      map.set(id, {
        discordId: id,
        name: resolveStaffName(profile, c, t('home.moderator')),
        avatar: resolveStaffAvatar(profile, c, id),
        role: role,
        total: 0, valid: 0, invalid: 0, pending: 0, accuracy: 0, trend: [],
      });
    }
    const s = map.get(id)!;
    s.total++;
    if (c.cuk_verdict === 'valid') s.valid++;
    else if (c.cuk_verdict === 'invalid') s.invalid++;
    else s.pending++;
  }
  for (const s of map.values()) {
    s.accuracy = s.total > 0 ? Math.round((s.valid / s.total) * 100) : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function buildWeeklyChart(cases: SapphireCase[]) {
  const now = Date.now();
  const days: Record<string, { valid: number; invalid: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days[key] = { valid: 0, invalid: 0 };
  }
  for (const c of cases) {
    const key = (c.created_at_sapphire || '').slice(0, 10);
    if (days[key]) {
      if (c.cuk_verdict === 'valid') days[key].valid++;
      else if (c.cuk_verdict === 'invalid') days[key].invalid++;
    }
  }
  return Object.entries(days).map(([date, d]) => ({
    date: new Date(date).toLocaleDateString('tr-TR', { weekday: 'short' }),
    valid: d.valid,
    invalid: d.invalid,
  }));
}

function translateReliability(status: string, t: (key: string) => string): string {
  if (status === 'Guvenilir') return t('status.reliable');
  if (status === 'Riskli') return t('status.risky');
  return t('status.monitoring');
}

export default function Home() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isMgmtOrSenior = session
    ? ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(session.role?.toLowerCase())
    : false;

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [casesData, staffData] = await Promise.all([
        getCases(200),
        getStaffProfiles()
      ]);
      setCases(casesData);
      setStaffProfiles(staffData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const total = Math.max(cases.length, 0);
  const valid = Math.max(cases.filter((c) => c.cuk_verdict === 'valid').length, 0);
  const invalid = Math.max(cases.filter((c) => c.cuk_verdict === 'invalid').length, 0);
  const pending = Math.max(total - valid - invalid, 0);
  const accuracy = total > 0 ? ((valid / total) * 100).toFixed(1) : 'â€”';
  const staffStats = buildStaffStats(cases, staffProfiles, t);
  const weeklyData = buildWeeklyChart(cases);
  const uniqueMods = staffStats.length;

  const generateReport = () => {
    const lines = staffStats.map((s, i) => {
      const status = getReliabilityStatus(s.valid, s.invalid);
      return `${i + 1}. ${s.name} â€” ${t('home.total')}: ${s.total} | ${t('pt.valid')}: ${s.valid} | ${t('pt.invalid')}: ${s.invalid} | ${t('home.accuracy')}: %${s.accuracy} | ${translateReliability(status, t)}`;
    });
    const text = `Lutheus CezaRapor â€” Report\n${'='.repeat(40)}\n${t('home.total')}: ${total} | ${t('pt.valid')}: ${valid} | ${t('pt.invalid')}: ${invalid} | ${t('pt.pending')}: ${pending}\n\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
    <Card className="p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        {loading ? (
          <><Skeleton className="h-6 w-12 mb-1" /><Skeleton className="h-3 w-16" /></>
        ) : (
          <><div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}</>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('home.title')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('home.subtitle').replace('{total}', String(total))}</p>
        </div>
        <div className="flex gap-2">
          {isMgmtOrSenior && (
            <Button variant="ghost" size="sm" onClick={generateReport} disabled={loading}>
              <Copy className="w-3.5 h-3.5" /> {t('home.copyReport')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {t('home.refresh')}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Gavel} label={t('home.statTotal')} value={total} color="bg-secondary text-muted-foreground" />
        <StatCard icon={CheckCircle2} label={t('home.statValid')} value={valid} sub={`%${accuracy} ${t('pt.valid').toLowerCase()}`} color="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={XCircle} label={t('home.statInvalid')} value={invalid} color="bg-destructive/15 text-destructive" />
        <StatCard icon={Users} label={t('home.statActiveStaff')} value={uniqueMods} color="bg-primary/15 text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* SECTION: HOME_WEEKLY_CHART */}
        {/* PURPOSE: HaftalÄ±k doÄŸrulama grafiÄŸini dil baÄŸÄ±msÄ±z veri anahtarlarÄ±yla gÃ¶sterir. */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> {t('home.weeklyTrend')}
            </h3>
          </div>
          {loading ? (
            <Skeleton className="h-[180px] w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInvalid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: 'var(--foreground)' }}
                />
                <Area type="monotone" dataKey="valid" name={t('pt.valid')} stroke="#22c55e" strokeWidth={2} fill="url(#colorValid)" />
                <Area type="monotone" dataKey="invalid" name={t('pt.invalid')} stroke="#ef4444" strokeWidth={2} fill="url(#colorInvalid)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* SECTION: HOME_DISTRIBUTION */}
        {/* PURPOSE: Durum daÄŸÄ±lÄ±mÄ±nÄ± kompakt yÃ¼kseklikte ve deterministik oranlarla gÃ¶sterir. */}
        <Card className="p-5 self-start">
          <h3 className="font-semibold text-sm text-foreground mb-4">{t('home.verdictDist')}</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-full rounded-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: t('home.statValid'), val: valid, total, color: 'bg-emerald-500' },
                { label: t('home.statInvalid'), val: invalid, total, color: 'bg-destructive' },
                { label: t('pt.pending'), val: pending, total, color: 'bg-amber-500' },
              ].map(({ label, val, total: tVal, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground">{val}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700`}
                      style={{ width: tVal > 0 ? `${Math.min(100, Math.max(0, (val / tVal) * 100))}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Staff Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> {t('home.staffPerf')}
          </h3>
          <span className="text-xs text-muted-foreground">{uniqueMods} {t('home.moderator').toLowerCase()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="py-3 px-5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.moderator')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.total')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.valid')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('pt.invalid')}</th>
                <th className="py-3 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.accuracy')}</th>
                <th className="py-3 px-5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('home.status')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-3 px-5"><Skeleton className="h-4 w-4" /></td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                    <td colSpan={4} />
                  </tr>
                ))
              ) : staffStats.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">{t('home.noData')}</td></tr>
              ) : staffStats.map((s, i) => {
                const status = getReliabilityStatus(s.valid, s.invalid);
                const statusVariant: any = status === 'Guvenilir' ? 'success' : status === 'Riskli' ? 'destructive' : 'warning';
                return (
                  <tr
                    key={s.discordId}
                    className="border-b border-border/30 hover:bg-secondary/20 cursor-pointer transition-colors"
                    onClick={() => navigate('/cases', { state: { search: s.name } })}
                  >
                    <td className="py-3 px-5 text-muted-foreground text-xs font-mono">{i + 1}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img src={s.avatar} alt="" className="w-8 h-8 rounded-full bg-secondary shrink-0" />
                        <span
                          className="font-medium text-sm text-foreground hover:text-primary hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/staff', { state: { discordId: s.discordId } });
                          }}
                        >
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-foreground">{s.total}</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-semibold">{s.valid}</td>
                    <td className="py-3 px-3 text-center text-destructive font-semibold">{s.invalid}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-bold text-sm ${s.accuracy >= 95 ? 'text-emerald-400' : s.accuracy >= 80 ? 'text-amber-400' : 'text-destructive'}`}>
                        %{s.accuracy}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center">
                      <Badge variant={statusVariant}>{translateReliability(status, t)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
