import { getValidDurationsForCase } from '../../lib/cukEngine';
import { minutesToHuman } from '../../lib/utils';
import { StatusBadge, type StatusKind } from './StatusBadge';
import type { SapphireCase } from '../../lib/supabase';

interface ValidDurationsPanelProps {
  caseData: SapphireCase;
}

function verdictToStatus(verdict: string): StatusKind {
  if (verdict === 'valid') return 'valid';
  if (verdict === 'invalid') return 'invalid';
  if (verdict === 'pending') return 'pending';
  return 'neutral';
}

function verdictLabel(verdict: string): string {
  if (verdict === 'valid') return 'Geçerli';
  if (verdict === 'invalid') return 'Hatalı';
  if (verdict === 'pending') return 'Manuel inceleme';
  return 'Manuel kontrol';
}

export function ValidDurationsPanel({ caseData }: ValidDurationsPanelProps) {
  const info = getValidDurationsForCase(caseData);
  const currentLabel = caseData.is_permanent
    ? 'Süresiz'
    : minutesToHuman(info.currentMinutes ?? 0);

  return (
    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 space-y-3">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Bu cezanın alabileceği süreler
      </div>

      {info.category ? (
        <p className="text-xs text-muted-foreground">
          Kategori: <span className="text-primary font-medium">{info.category}</span>
        </p>
      ) : (
        <p className="text-xs text-amber-400">Kategori tespit edilemedi — manuel inceleme gerekir.</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-background/40 border border-border/40">
          <div className="text-muted-foreground mb-0.5">Minimum</div>
          <div className="font-medium">{info.minMinutes != null ? minutesToHuman(info.minMinutes) : '—'}</div>
        </div>
        <div className="p-2 rounded-lg bg-background/40 border border-border/40">
          <div className="text-muted-foreground mb-0.5">Maksimum</div>
          <div className="font-medium">{info.maxMinutes != null ? minutesToHuman(info.maxMinutes) : '—'}</div>
        </div>
      </div>

      {info.allowedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {info.allowedLabels.map((label) => (
            <span
              key={label}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-border/50 bg-secondary/50 text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Tanımlı süre kademesi yok (yönetim / özel kural).</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Mevcut süre</div>
          <div className="text-sm font-semibold">{currentLabel}</div>
        </div>
        <StatusBadge status={verdictToStatus(info.verdict)} label={verdictLabel(info.verdict)} />
      </div>

      {info.message && (
        <p
          className={`text-xs leading-relaxed ${
            info.verdict === 'invalid'
              ? 'text-red-400'
              : info.verdict === 'valid'
                ? 'text-emerald-400'
                : 'text-amber-400'
          }`}
        >
          {info.message}
        </p>
      )}
    </div>
  );
}
