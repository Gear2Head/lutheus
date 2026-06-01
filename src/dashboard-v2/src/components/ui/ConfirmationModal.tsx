import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Onayla',
  danger = false,
  loading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border/50 rounded-[24px] shadow-2xl p-6 glass-panel animate-in fade-in">
        <div className="flex items-start gap-4">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="outline" size="md" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button
            variant={danger ? 'destructive' : 'primary'}
            size="md"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'İşleniyor...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
