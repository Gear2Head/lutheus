import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WifiOff, RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Lutheus ErrorBoundary] Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDbError = this.state.error?.message?.includes('Supabase') || 
                        this.state.error?.message?.includes('fetch') || 
                        this.state.error?.message?.includes('521') ||
                        this.state.error?.message?.includes('525') ||
                        this.state.error?.message?.includes('PGRST002') ||
                        this.state.error?.message?.includes('failed');

      return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#050506] text-white p-6 relative select-none text-center">
          {/* Cybernetic glowing background overlay */}
          <div className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: "url('banner.png')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#050506]/95 to-[#050506] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-destructive/5 rounded-full filter blur-[120px] pointer-events-none" />

          <div className="max-w-md w-full text-center space-y-7 rounded-[28px] p-8 bg-[#0D0D11]/60 border border-white/[0.08] backdrop-blur-3xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)] relative z-10 transition-all hover:border-white/[0.12] duration-300">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-[#FF453A] animate-pulse">
              {isDbError ? <WifiOff className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
            </div>
            
            <div className="space-y-3">
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                {isDbError ? 'Veri Tabanı Bağlantısı Koptu' : 'Sistem Hatası Oluştu'}
              </h1>
              <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                {isDbError 
                  ? 'Supabase bulut sunucularına şu an erişilemiyor. Lütfen internet bağlantınızı kontrol edip tekrar deneyin veya sistem yöneticinize danışın.'
                  : 'Moderasyon panelinde beklenmedik bir çalışma zamanı hatası algılandı.'}
              </p>
            </div>

            {/* Error Diagnostics Collapse */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.04] text-left">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-1.5 font-bold font-sans">Hata Detayları</span>
              <p className="text-[11px] font-mono text-[#FF453A]/90 break-all leading-normal max-h-24 overflow-y-auto select-text pr-2 custom-scrollbar">
                {this.state.error?.message || 'Bilinmeyen Hata'}
              </p>
            </div>

            <button
              onClick={this.handleRetry}
              className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#5E5CE6] hover:bg-[#5E5CE6]/90 text-white text-xs font-bold transition-all shadow-lg shadow-[#5E5CE6]/20 cursor-pointer active:scale-[0.98]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Sistemi Yeniden Yükle
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
