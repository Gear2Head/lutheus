import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Image as ImageIcon, FileText, Sparkles, Loader2, 
  ExternalLink, CheckCircle2, AlertTriangle, Shield, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Play, Video, Maximize2
} from 'lucide-react';
import { getCaseProof, CaseProof, SapphireCase, getEmbeddedProofs } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getGlassClass } from '../lib/theme';
import { useToast } from '../contexts/ToastContext';
import { isManagementRole } from '../lib/auth';

interface ProofDrawerProps {
  caseId: string | null;
  onClose: () => void;
  caseData?: SapphireCase | null;
  intensity?: string;
  theme?: string;
  panelStyle?: string; // 'side' | 'center'
  onOpenLightbox?: (url: string) => void;
}

// Bilinmeyen kullanıcı tespiti — "Unknown User", "Bilinmeyen" vb.
const UNKNOWN_NAME_RE = /^(unknown\s*user|unknown|bilinmeyen\s*kullan[iı]c[iı]|bilinmeyen\s*kullanici|bilinmeyen|unknown\s*moderator|bilinmeyen\s*yetkili)$/i;
function isUnknownName(name?: string | null): boolean {
  if (!name || name.trim() === '') return true;
  return UNKNOWN_NAME_RE.test(name.trim());
}

// Discord CDN URL'sinden size kısıtlamalarını temizle → tam çözünürlük
function getFullResUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // width/height parametrelerini kaldır
    u.searchParams.delete('width');
    u.searchParams.delete('height');
    // webp yerine orijinal format
    if (u.searchParams.get('format') === 'webp') {
      u.searchParams.delete('format');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export default function ProofDrawer({
  caseId,
  onClose,
  caseData,
  intensity = 'frosted',
  theme = 'deepspace',
  panelStyle = 'side',
  onOpenLightbox,
}: ProofDrawerProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const isManagement = session ? isManagementRole(session.role) : false;
  const [proof, setProof] = useState<CaseProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentProofIndex, setCurrentProofIndex] = useState(0);
  const [allProofs, setAllProofs] = useState<Array<{ proof_url: string | null; video_url?: string | null; thumbnail_url?: string | null; raw_text?: string | null; source_case_id?: string }>>([]);
  const [embeddedProofs, setEmbeddedProofs] = useState<CaseProof[]>([]);
  const [isZoomed, setIsZoomed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // ESC key to close lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    if (lightboxUrl) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightboxUrl]);

  useEffect(() => {
    setIsZoomed(false);
    setLightboxUrl(null);
    setLightboxZoom(1);
    if (!caseId) {
      setProof(null);
      setAllProofs([]);
      setCurrentProofIndex(0);
      setEmbeddedProofs([]);
      return;
    }

    async function fetchProof() {
      setLoading(true);
      try {
        const data = await getCaseProof(caseId!);
        setProof(data);
        
        // Build all proofs array including additional proofs
        const proofs: Array<{ proof_url: string | null; video_url?: string | null; thumbnail_url?: string | null; raw_text?: string | null; source_case_id?: string }> = [];
        
        if (data?.proof_url || data?.video_url || data?.thumbnail_url) {
          proofs.push({
            proof_url: data.proof_url,
            video_url: data.video_url,
            thumbnail_url: data.thumbnail_url,
            raw_text: data.raw_text,
            source_case_id: (data.embedded_from_case_id || caseId) ?? undefined
          });
        }
        
        if (data?.additional_proofs && data.additional_proofs.length > 0) {
          proofs.push(...data.additional_proofs.map(p => ({ ...p, source_case_id: caseId ?? undefined })));
        }
        
        // Fetch embedded proofs from other cases
        const embedded = await getEmbeddedProofs(caseId!);
        setEmbeddedProofs(embedded);
        
        // Add embedded proofs to the array
        embedded.forEach(ep => {
          if (ep.proof_url || ep.video_url || ep.thumbnail_url) {
            proofs.push({
              proof_url: ep.proof_url,
              video_url: ep.video_url,
              thumbnail_url: ep.thumbnail_url,
              raw_text: ep.raw_text,
              source_case_id: ep.case_id
            });
          }
        });
        
        setAllProofs(proofs);
        setCurrentProofIndex(0);
      } catch (err: any) {
        console.error('Error fetching proof:', err);
        showToast('Kanıt bilgisi alınamadı.', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchProof();
  }, [caseId]);

  const triggerAiAnalysis = async () => {
    if (!caseId) return;
    setAnalyzing(true);
    try {
      const token = session?.idToken;
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
      const res = await fetch(`${baseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ case_id: caseId, force_reanalyze: true })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const resData = await res.json();
      if (resData.success && resData.analysis) {
        setProof(prev => prev ? {
          ...prev,
          ai_verdict: resData.analysis.ai_verdict,
          ai_analysis: resData.analysis.ai_analysis
        } : {
          case_id: caseId,
          proof_url: null,
          raw_text: null,
          ai_verdict: resData.analysis.ai_verdict,
          ai_analysis: resData.analysis.ai_analysis
        });
        showToast('Yapay Zeka denetimi tamamlandı!', 'success');
      } else {
        throw new Error('Analiz sonucu boş döndü.');
      }
    } catch (err: any) {
      console.error('Error running AI analysis:', err);
      showToast(`AI Analizi Başarısız: ${err.message}`, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const getDiscordChannelLink = () =>
    `https://discord.com/channels/1223431616081166336/1445462327141863657`;

  // Görsel tam çözünürlük URL'si
  const currentProof = allProofs[currentProofIndex] || { proof_url: null, video_url: null, thumbnail_url: null, raw_text: null };
  const fullResProofUrl = getFullResUrl(currentProof.proof_url);
  const videoUrl = currentProof.video_url;
  const thumbnailUrl = currentProof.thumbnail_url;
  const currentRawText = currentProof.raw_text || proof?.raw_text;
  
  const hasMultipleProofs = allProofs.length > 1;
  const isVideo = Boolean(videoUrl);

  // Ceza özeti: bilinmeyen kullanıcıyı sadece ID ile göster
  const displayName = caseData
    ? isUnknownName(caseData.punished_user_display_name)
      ? caseData.punished_user_discord_id || '—'
      : caseData.punished_user_display_name
    : '—';

  const isCenter = panelStyle === 'center';

  const drawerContent = (
    <>
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-black/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 flex items-center justify-center text-[#5E5CE6]">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="text-[14.5px] font-bold text-white tracking-tight">Ceza Kanıt Paneli</h3>
            <span className="text-[11px] font-mono text-white/40 block mt-0.5">Ceza ID: #{caseId}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 soft-scroll">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#5E5CE6] animate-spin" />
            <span className="text-xs text-white/40 font-medium">Kanıt verisi yükleniyor...</span>
          </div>
        ) : (
          <>
            {/* Case Info Summary */}
            {caseData && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3.5">
                <h4 className="text-[12.5px] font-bold text-white/80">Ceza Özeti</h4>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-white/30 uppercase block">Cezalandırılan</span>
                    <span className="text-[12px] font-semibold text-white/80 block truncate font-mono">
                      {displayName}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-white/30 uppercase block">Sebep</span>
                    <span className="text-[12px] font-semibold text-white/80 block truncate">
                      {caseData.reason_raw || '—'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-white/30 uppercase block">Yetkili</span>
                    <span className="text-[12px] font-semibold text-white/80 block truncate">
                      {caseData.author_display_name || `ID: ${caseData.author_discord_id}`}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-white/30 uppercase block">Kategori</span>
                    <span className="text-[12px] font-semibold text-[#5E5CE6] block truncate">
                      {caseData.cuk_analysis?.category || 'Belirsiz'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Scraped Proof Info */}
            {!proof ? (
              <div className="p-5 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-[#FF9F0A] mx-auto opacity-75" />
                <h5 className="text-[13px] font-bold text-white/80">Yerel Kanıt Bulunamadı</h5>
                <p className="text-[11.5px] text-[#8E8E93] leading-relaxed max-w-xs mx-auto">
                  Bu ceza kaydına ait taranmış görsel veya sohbet logu bulunmuyor. Lütfen uzantıdaki <strong>Discord&apos;u Aç ve Kanıtları Tara</strong> özelliğini kullanın.
                </p>
                <a
                  href={getDiscordChannelLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#5865F2]/90 text-white text-[11px] font-bold transition-all shadow-md mt-1 cursor-pointer"
                >
                  <ExternalLink size={12} />
                  Kanıt Kanalını Aç
                </a>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Evidence Navigation */}
                {hasMultipleProofs && (
                  <div className="flex items-center justify-between px-2">
                    <button
                      onClick={() => {
                        setIsZoomed(false);
                        setCurrentProofIndex(prev => Math.max(0, prev - 1));
                      }}
                      disabled={currentProofIndex === 0}
                      className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-mono text-white/50">
                        Kanıt {currentProofIndex + 1} / {allProofs.length}
                      </span>
                      {currentProof.source_case_id && currentProof.source_case_id !== caseId && (
                        <span className="text-[9px] text-[#5E5CE6] font-mono">
                          Case #{currentProof.source_case_id}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setIsZoomed(false);
                        setCurrentProofIndex(prev => Math.min(allProofs.length - 1, prev + 1));
                      }}
                      disabled={currentProofIndex === allProofs.length - 1}
                      className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
                
                {/* Image/Video Preview */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider block">
                    {isVideo ? 'Video Kanıt' : 'Görsel Kanıt'}
                  </span>
                  
                  {isVideo ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 group shadow-lg bg-black/40">
                      {/* Video thumbnail with play button */}
                      <div className="relative">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt="Video thumbnail"
                            className="w-full object-cover max-h-72"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-48 bg-black/60 flex items-center justify-center">
                            <Video size={48} className="text-white/30" />
                          </div>
                        )}
                        {/* Play button overlay */}
                        <button
                          onClick={() => window.open(videoUrl ?? undefined, '_blank')}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-all cursor-pointer group"
                        >
                          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play size={24} className="text-white fill-white ml-1" />
                          </div>
                        </button>
                      </div>
                      {/* Video link */}
                      <a
                        href={videoUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 border border-white/10 text-white/80 hover:text-white transition-all hover:bg-black/80 z-10"
                        title="Videoyu yeni sekmede aç"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  ) : fullResProofUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 group shadow-lg bg-black/40">
                      {/* Görsel — tıklanınca lightbox açar */}
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxUrl(fullResProofUrl);
                          setLightboxZoom(1);
                        }}
                        className="w-full block border-none bg-transparent p-0 cursor-zoom-in"
                        title="Yakınlaştır (Tam Ekran)"
                      >
                        <img
                          src={fullResProofUrl}
                          alt="Proof"
                          className="w-full object-contain max-h-72 group-hover:brightness-90 transition-all duration-200"
                          loading="lazy"
                        />
                        {/* Zoom hint overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                          <div className="bg-black/70 border border-white/20 rounded-xl px-3 py-2 flex items-center gap-1.5 text-white text-[12px] font-bold shadow-xl">
                            <Maximize2 size={14} />
                            Tam Ekran Görüntüle
                          </div>
                        </div>
                      </button>
                      {/* Dışarıda aç linki */}
                      <a
                        href={fullResProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 border border-white/10 text-white/80 hover:text-white transition-all hover:bg-black/80 z-10"
                        title="Yeni sekmede aç"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center gap-2">
                      <ImageIcon size={24} className="text-white/20" />
                      <span className="text-[11.5px] text-[#8E8E93] font-medium">Bu kanıtta ekran görüntüsü bulunmamaktadır.</span>
                    </div>
                  )}
                </div>

                {/* Scraped Text */}
                {currentRawText && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider block">Ham Kanıt Metni</span>
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/20 text-[11.5px] font-mono text-white/75 leading-relaxed max-h-40 overflow-y-auto soft-scroll select-all">
                      {currentRawText}
                    </div>
                  </div>
                )}

                {/* AI Verification Section */}
                {isManagement && (
                  <div className="space-y-3.5 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Yapay Zeka Denetimi</span>
                      {proof.ai_verdict && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider ${
                          proof.ai_verdict === 'valid'
                            ? 'bg-[#30D158]/10 border border-[#30D158]/20 text-[#30D158]'
                            : 'bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A]'
                        }`}>
                          {proof.ai_verdict === 'valid' ? (
                            <><CheckCircle2 size={10} /> GEÇERLİ KANIT</>
                          ) : (
                            <><AlertTriangle size={10} /> GEÇERSİZ KANIT</>
                          )}
                        </span>
                      )}
                    </div>

                    {proof.ai_analysis ? (
                      <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                        <div className="flex items-center gap-1.5 text-white/80 font-bold text-[12px]">
                          <Sparkles size={13} className="text-[#5E5CE6]" />
                          <span>Groq AI Analiz Raporu</span>
                        </div>
                        <p className="text-[12px] text-white/70 leading-relaxed font-medium">
                          {proof.ai_analysis}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-[#5E5CE6]/20 bg-[#5E5CE6]/[0.02] text-center space-y-3">
                        <Sparkles className="w-6 h-6 text-[#5E5CE6] mx-auto animate-pulse" />
                        <h5 className="text-[12.5px] font-bold text-white/80">AI Değerlendirmesi Yapılmamış</h5>
                        <p className="text-[11.5px] text-[#8E8E93] max-w-xs mx-auto">
                          Bu kanıt henüz Groq AI (Llama-3-Vision OCR) tarafından denetlenmedi. Hemen analiz başlatabilirsiniz.
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <button
                      onClick={triggerAiAnalysis}
                      disabled={analyzing}
                      className="w-full h-10 rounded-xl bg-[#5E5CE6] hover:bg-[#5E5CE6]/90 disabled:bg-[#5E5CE6]/40 text-white font-extrabold text-[12px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          OCR Analizi Yapılıyor...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          {proof.ai_analysis ? 'Yeniden Analiz Et (Groq AI)' : 'Groq AI Analizini Tetikle'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {caseId && (
            <>
              {isCenter ? (
                /* ── Orta Modal (center) ── */
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 16 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 shadow-2xl flex flex-col rounded-2xl max-h-[88vh] ${getGlassClass(intensity, theme)}`}
                  >
                    {drawerContent}
                  </motion.div>
                </>
              ) : (
                /* ── Sağ Panel (side) ── */
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
                  />
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[480px] z-50 shadow-2xl flex flex-col overflow-hidden ${getGlassClass(intensity, theme)}`}
                  >
                    {drawerContent}
                  </motion.div>
                </>
              )}
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Lightbox Overlay ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {lightboxUrl && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setLightboxUrl(null)}
                className="fixed inset-0 bg-black/95 z-[200] cursor-zoom-out"
                onKeyDown={(e) => e.key === 'Escape' && setLightboxUrl(null)}
              />

              {/* Controls bar */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                className="fixed top-4 right-4 z-[210] flex items-center gap-2"
              >
                <div className="flex items-center gap-1 bg-black/70 border border-white/10 rounded-xl p-1 backdrop-blur-sm">
                  <button
                    onClick={() => setLightboxZoom(z => Math.max(0.5, z - 0.25))}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                    title="Uzaklaştır"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span className="text-[11px] font-mono text-white/50 min-w-[44px] text-center">{Math.round(lightboxZoom * 100)}%</span>
                  <button
                    onClick={() => setLightboxZoom(z => Math.min(5, z + 0.25))}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                    title="Yakınlaştır"
                  >
                    <ZoomIn size={15} />
                  </button>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <button
                    onClick={() => setLightboxZoom(1)}
                    className="px-2 h-8 rounded-lg hover:bg-white/10 text-[10px] font-mono text-white/50 hover:text-white transition-all cursor-pointer"
                    title="Sıfırla"
                  >
                    1:1
                  </button>
                </div>
                <a
                  href={lightboxUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-xl bg-black/70 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                  title="Yeni sekmede aç"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  onClick={() => setLightboxUrl(null)}
                  className="w-9 h-9 rounded-xl bg-black/70 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 text-white/60 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                  title="Kapat (ESC)"
                >
                  <X size={16} />
                </button>
              </motion.div>

              {/* Zoomed image */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="fixed inset-0 z-[205] flex items-center justify-center pointer-events-none"
              >
                <img
                  src={lightboxUrl}
                  alt="Kanıt (tam ekran)"
                  className="max-w-[92vw] max-h-[90vh] rounded-xl shadow-2xl border border-white/10 object-contain pointer-events-auto select-none"
                  style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center', transition: 'transform 150ms ease-out' }}
                  onWheel={(e) => {
                    e.stopPropagation();
                    setLightboxZoom(z => {
                      const delta = e.deltaY > 0 ? -0.1 : 0.1;
                      return Math.min(5, Math.max(0.5, z + delta));
                    });
                  }}
                  onClick={e => e.stopPropagation()}
                  draggable={false}
                />
              </motion.div>

              {/* ESC hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[210] pointer-events-none"
              >
                <div className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 text-[11px] text-white/40">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white/60">ESC</kbd>
                  veya dışarıya tıkla
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
