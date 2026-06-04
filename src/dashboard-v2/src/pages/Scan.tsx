import { useState, useEffect, useRef } from 'react';
import { Play, Square, Settings2, Calendar, Activity, RefreshCw, Database, WifiOff, Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Accordion } from '../components/ui/Accordion';
import { useLanguage } from '../contexts/LanguageContext';
import { getPendingSyncCount, triggerManualSync } from '../lib/supabase';

interface ScanProgress {
  status: 'idle' | 'running' | 'done' | 'error';
  currentPage: number;
  totalPages: number;
  casesFound: number;
  elapsed: number;
}

function sendToServiceWorker(action: string, options?: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      // Dev mode - simulate
      setTimeout(() => resolve({ success: true, simulated: true }), 500);
      return;
    }
    chrome.runtime.sendMessage({ action, options }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export default function Scan() {
  const { t, language } = useLanguage();
  const [progress, setProgress] = useState<ScanProgress>({
    status: 'idle',
    currentPage: 0,
    totalPages: 0,
    casesFound: 0,
    elapsed: 0,
  });
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null);

  const [targetPages, setTargetPages] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailedMode, setDetailedMode] = useState(false);
  const [detailLimit, setDetailLimit] = useState(0);
  const [delay, setDelay] = useState(1500);
  const [openAdminOnDone, setOpenAdminOnDone] = useState(true);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    getPendingSyncCount().then(setPendingSync);

    // Listen for scan progress events from service worker
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      const listener = (message: { action: string; payload?: { currentPage?: number; totalPages?: number; casesFound?: number } }) => {
        if (message.action === 'SCAN_PROGRESS_EVENT') {
          setProgress((prev) => ({
            ...prev,
            status: 'running',
            currentPage: message.payload?.currentPage || prev.currentPage,
            totalPages: message.payload?.totalPages || prev.totalPages,
            casesFound: message.payload?.casesFound || prev.casesFound,
          }));
        }
        if (message.action === 'SCAN_DONE_EVENT') {
          setProgress((prev) => ({ ...prev, status: 'done' }));
          stopElapsed();
          getPendingSyncCount().then(setPendingSync);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  function startElapsed() {
    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setProgress((prev) => ({
        ...prev,
        elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
  }

  function stopElapsed() {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }

  const handleStartScan = async () => {
    setProgress({ status: 'running', currentPage: 0, totalPages: 0, casesFound: 0, elapsed: 0 });
    startElapsed();
    try {
      const payload = {
        pages: targetPages || null,
        startDate: startDate || null,
        endDate: endDate || null,
        detailedMode,
        detailLimit,
        delay,
        openAdminOnDone,
      };
      await sendToServiceWorker('RUN_AUTONOMOUS_SCAN', payload);
    } catch (err) {
      setProgress((prev) => ({ ...prev, status: 'error' }));
      stopElapsed();
    }
  };

  const handleStopScan = async () => {
    await sendToServiceWorker('CANCEL_AUTONOMOUS_SCAN');
    setProgress((prev) => ({ ...prev, status: 'idle' }));
    stopElapsed();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await triggerManualSync();
      setSyncResult(result);
      const pending = await getPendingSyncCount();
      setPendingSync(pending);
    } finally {
      setSyncing(false);
    }
  };

  const setDatePreset = (preset: string) => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'day') { setStartDate(fmt(now)); setEndDate(fmt(now)); }
    else if (preset === 'week') {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      setStartDate(fmt(s)); setEndDate(fmt(now));
    }
    else if (preset === 'month') {
      const s = new Date(now); s.setDate(s.getDate() - 30);
      setStartDate(fmt(s)); setEndDate(fmt(now));
    }
    else { setStartDate(''); setEndDate(''); }
  };

  const isRunning = progress.status === 'running';
  const pct = progress.totalPages > 0
    ? Math.min(100, Math.round((progress.currentPage / progress.totalPages) * 100))
    : 0;

  // Tooltip Helper State
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const InfoIconTooltip = ({ id, text }: { id: string; text: string }) => {
    const isVisible = activeTooltip === id;
    return (
      <div className="relative inline-flex items-center ml-2">
        <button
          type="button"
          onMouseEnter={() => setActiveTooltip(id)}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={(e) => { e.preventDefault(); setActiveTooltip(isVisible ? null : id); }}
          className="text-muted-foreground hover:text-primary transition-colors p-0.5 focus:outline-none"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        {isVisible && (
          <div className="absolute left-6 top-1/2 -translate-y-1/2 w-64 p-2.5 text-xs text-foreground bg-card border border-border/80 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-left-2">
            {text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in pb-6">
      <div className="pt-2">
        <h2 className="text-2xl font-bold tracking-tight">{t('scan.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('scan.subtitle')}</p>
      </div>

      {/* Main scan card */}
      <Card className="p-6 shadow-lg border-border/50">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('scan.targetPage')}</label>
              <Input
                value={targetPages}
                onChange={(e) => setTargetPages(e.target.value)}
                placeholder="örn. 5 veya 1-10"
                disabled={isRunning}
              />
              <p className="text-[11px] text-muted-foreground">{t('scan.targetPageDesc')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('scan.dateFilter')}</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="pl-9" disabled={isRunning} />
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="relative flex-1">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" className="pl-9" disabled={isRunning} />
                </div>
              </div>
              <div className="flex gap-1.5 mt-1">
                {[(language === 'tr' ? 'Gün' : 'Day'), (language === 'tr' ? 'Hafta' : 'Week'), (language === 'tr' ? 'Ay' : 'Month'), (language === 'tr' ? 'Tümü' : 'All')].map((label, i) => {
                  const presets = ['day', 'week', 'month', 'all'];
                  return (
                    <button
                      key={label}
                      onClick={() => setDatePreset(presets[i])}
                      disabled={isRunning}
                      className="px-3 py-1 text-[11px] rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold transition-colors disabled:opacity-50"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          <Accordion title={<span className="flex items-center gap-2 text-sm"><Settings2 className="w-4 h-4" /> {t('scan.advanced')}</span>}>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors relative">
                <input
                  type="checkbox"
                  id="detailedMode"
                  checked={detailedMode}
                  onChange={(e) => setDetailedMode(e.target.checked)}
                  disabled={isRunning}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="detailedMode" className="font-semibold text-sm text-foreground cursor-pointer">{t('scan.detailed')}</label>
                  <div className="text-xs text-muted-foreground mt-0.5">{t('scan.detailedDesc')}</div>
                </div>
                <InfoIconTooltip id="detailedMode" text={t(`tooltip.detailedMode.${detailedMode}`)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t('scan.detailLimit')}</label>
                  <Input type="number" value={detailLimit} onChange={(e) => setDetailLimit(Number(e.target.value))} disabled={isRunning} />
                  <p className="text-[10px] text-muted-foreground">{t('scan.detailLimitDesc')}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t('scan.delay')}</label>
                  <Input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} disabled={isRunning} />
                </div>
              </div>

              <div className="space-y-2 flex items-center">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={openAdminOnDone} onChange={(e) => setOpenAdminOnDone(e.target.checked)} disabled={isRunning} />
                  <span className="text-muted-foreground">{t('scan.openAdmin')}</span>
                </label>
                <InfoIconTooltip id="openAdminOnDone" text={t(`tooltip.openAdminOnDone.${openAdminOnDone}`)} />
              </div>
            </div>
          </Accordion>

          <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
            {!isRunning ? (
              <Button size="lg" className="w-full sm:w-auto min-w-[180px]" onClick={handleStartScan}>
                <Play className="w-4 h-4 fill-current" /> {t('scan.start')}
              </Button>
            ) : (
              <Button size="lg" variant="destructive" className="w-full sm:w-auto" onClick={handleStopScan}>
                <Square className="w-4 h-4 fill-current" /> {t('scan.stop')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Progress */}
      {(isRunning || progress.status === 'done' || progress.status === 'error') && (
        <Card className={`p-6 border-primary/20 animate-in ${progress.status === 'error' ? 'border-destructive/30 bg-destructive/5' : 'bg-primary/5'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Activity className={`w-4 h-4 text-primary ${isRunning ? 'animate-pulse' : ''}`} />
              {isRunning ? t('scan.activeScan') : progress.status === 'done' ? t('scan.completed') : t('scan.error')}
            </h3>
            <span className="font-mono text-sm text-primary font-bold">{pct}%</span>
          </div>
          <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progress.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${isRunning ? Math.max(pct, 5) : progress.status === 'done' ? 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Sayfa {progress.currentPage}/{progress.totalPages} — {progress.casesFound} kayıt</span>
            <span>{t('scan.elapsed')}: {progress.elapsed}s</span>
          </div>
        </Card>
      )}

      {/* Local Sync Panel */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> {t('scan.localSync')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('scan.localSyncDesc')}
            </p>
          </div>
          {pendingSync > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">{pendingSync} {t('nav.pending')}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || pendingSync === 0}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('scan.syncing') : t('scan.syncManual')}
          </Button>
        </div>
        {syncResult && (
          <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
            <p className="text-xs text-muted-foreground">
              {t('nav.synced')}: <span className="text-emerald-400 font-bold">{syncResult.synced}</span>
              {' '} — {t('scan.error')}: <span className="text-destructive font-bold">{syncResult.errors}</span>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
