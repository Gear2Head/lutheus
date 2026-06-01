import { Badge } from './Badge';

export type StatusKind = 'valid' | 'invalid' | 'pending' | 'neutral' | 'stale';

const LABELS: Record<StatusKind, string> = {
  valid: 'Doğru',
  invalid: 'Hatalı',
  pending: 'Beklemede',
  neutral: 'Nötr',
  stale: 'Eski Yetkili',
};

const VARIANT: Record<StatusKind, 'success' | 'destructive' | 'warning' | 'default' | 'secondary'> = {
  valid: 'success',
  invalid: 'destructive',
  pending: 'warning',
  neutral: 'default',
  stale: 'secondary',
};

interface StatusBadgeProps {
  status: StatusKind;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {label || LABELS[status]}
    </Badge>
  );
}
