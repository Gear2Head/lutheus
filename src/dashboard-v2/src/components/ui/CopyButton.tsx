import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

type CopyState = 'idle' | 'copying' | 'success' | 'error';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  onError?: (message: string) => void;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('COPY_FAILED');
}

export function CopyButton({ value, label = 'Kopyala', className, onError }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!value || state === 'copying') return;

    setState('copying');
    try {
      await writeClipboard(value);
      setState('success');
      resetTimer.current = setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
      onError?.('Kopyalanamadı');
      resetTimer.current = setTimeout(() => setState('idle'), 1500);
    }
  }, [value, state, onError]);

  const Icon = state === 'success' ? Check : Copy;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
        state === 'success' && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
        state === 'error' && 'border-destructive/40 bg-destructive/15 text-destructive',
        (state === 'idle' || state === 'copying') && 'border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30',
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
