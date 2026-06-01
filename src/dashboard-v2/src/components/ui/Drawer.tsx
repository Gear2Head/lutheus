import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  position?: 'right' | 'center';
}

export function Drawer({ isOpen, onClose, title, children, position = 'right' }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (position === 'center') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[12px] transition-all duration-300" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-card border border-border/50 rounded-[28px] shadow-2xl max-h-[85vh] flex flex-col glass-panel animate-in fade-in">
          <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 soft-scroll">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/75 backdrop-blur-[12px] transition-all duration-300" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border/50 shadow-2xl flex flex-col h-full glass-panel animate-in slide-in-from-right-4">
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 soft-scroll">{children}</div>
      </div>
    </div>
  );
}
