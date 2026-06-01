import { Gavel, MicOff, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

function penaltyIcon(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('ban')) return <Gavel className="w-3 h-3 text-rose-400 shrink-0" />;
  if (t.includes('mute')) return <MicOff className="w-3 h-3 text-amber-400 shrink-0" />;
  if (t.includes('warn')) return <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />;
  return <HelpCircle className="w-3 h-3 text-muted-foreground shrink-0" />;
}

interface CaseIdBadgeProps {
  caseId: string;
  type?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  asButton?: boolean;
}

export function CaseIdBadge({ caseId, type = 'unknown', onClick, className, asButton = true }: CaseIdBadgeProps) {
  const Tag = asButton ? 'button' : 'span';
  return (
    <Tag
      type={asButton ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-mono text-xs font-semibold',
        'border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/40',
        'transition-colors cursor-pointer max-w-full',
        className,
      )}
    >
      {penaltyIcon(type)}
      <span>#{caseId}</span>
    </Tag>
  );
}
