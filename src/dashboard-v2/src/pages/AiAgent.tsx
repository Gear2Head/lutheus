// SECTION: AI_AGENT_PAGE
// PURPOSE: CUK Denetim AI sohbet ekranı + Sorgu Geçmişi + Doğrudan DM Mesaj Paneli.
// Sekme 1: Sohbet (mevcut Groq analiz arayüzü)
// Sekme 2: Sorgu Geçmişi (bot_ai_query audit_logs tablosundan)
// Sekme 3: DM Gönder (seçilen yetkili veya rütbeye bot üzerinden DM)

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import {
  Bot, Image as ImageIcon, Send, Sparkles, X, AlertTriangle,
  History, MessageSquareDot, RefreshCw, CheckCircle, XCircle,
  Clock, Users, ChevronDown, Shield
} from 'lucide-react';
import { validateCase } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { formatDateTime } from '../lib/utils';
import { hasPermission } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  badge?: { source: string; confidence: string };
  imageAttached?: string;
}

interface AiQueryLog {
  id: string;
  actor_discord_id: string | null;
  created_at: string;
  metadata: {
    discordId?: string;
    displayName?: string;
    role?: string;
    question?: string;
    response?: {
      valid?: boolean;
      categoryMatched?: string;
      summary?: string;
      recommendedAction?: string;
    };
    hasImage?: boolean;
    quotaRemaining?: number;
    quotaLimit?: number;
  };
}

interface StaffProfile {
  discord_id: string;
  display_name: string;
  staff_rank: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  discord_moderatoru: 'Discord Moderatörü',
  kidemli_discord_moderatoru: 'Kıdemli Moderatör',
  senior_moderator: 'Senior Moderatör',
  discord_destek_ekibi: 'Destek Ekibi',
  discord_yoneticisi: 'Discord Yöneticisi',
  genel_sorumlu: 'Genel Sorumlu',
  yonetici: 'Yönetici',
  admin: 'Admin',
  kurucu: 'Kurucu',
};

type TabId = 'chat' | 'history' | 'dm';

// ─── Component ────────────────────────────────────────────────────────────────
export default function AiAgent() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('chat');

  // ── Chat tab state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── History tab state
  const [queryLogs, setQueryLogs] = useState<AiQueryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // ── DM tab state
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [dmTarget, setDmTarget] = useState<'role' | 'user'>('role');
  const [dmRole, setDmRole] = useState<string>('all');
  const [dmUserId, setDmUserId] = useState<string>('');
  const [dmMessage, setDmMessage] = useState('');
  const [dmSending, setDmSending] = useState(false);

  const isAdmin = hasPermission(session?.profile?.role, 'admin');
  const avatarUrl = session?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.profile?.discordId || 'user'}`;

  // ── Welcome message
  useEffect(() => {
    setMessages([{ id: 0, role: 'assistant', content: t('ai.welcome') }]);
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load query history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:')
        ? 'https://lutheus.vercel.app' : '';
      const res = await fetch(`${baseUrl}/api/admin/audit-logs?action=bot_ai_query&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueryLogs(data.logs || []);
    } catch (err: any) {
      showToast('Sorgu geçmişi yüklenemedi: ' + err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.idToken]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'dm') loadStaff();
  }, [activeTab]);

  // ── Load staff for DM tab
  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:')
        ? 'https://lutheus.vercel.app' : '';
      const res = await fetch(`${baseUrl}/api/admin/staff-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // staff-profiles endpoint returns { items: [...] }
      const profiles = (data.items || []).filter((p: any) => p.isActiveStaff !== false);
      setStaffList(profiles.map((p: any) => ({
        discord_id: p.discordId || p.discord_id || '',
        display_name: p.displayName || p.name || p.username || p.discord_id || '',
        staff_rank: p.role || p.staffRank || p.staff_rank || 'pending',
      })));
    } catch {
      setStaffList([]);
    } finally {
      setStaffLoading(false);
    }
  }, [session?.idToken]);

  // ── Image handling (chat tab)
  function parseUserInput(text: string): { reason: string; durationMins: number | null } {
    const hourMatch = text.match(/(\d+)\s*(saat|hour)/i);
    const minuteMatch = text.match(/(\d+)\s*(dakika|dk|min)/i);
    const dayMatch = text.match(/(\d+)\s*(gün|gun|day)/i);
    let mins: number | null = null;
    if (dayMatch) mins = Number(dayMatch[1]) * 1440;
    else if (hourMatch) mins = Number(hourMatch[1]) * 60;
    else if (minuteMatch) mins = Number(minuteMatch[1]);
    return { reason: text, durationMins: mins };
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t('ai.uploadError'), 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { setSelectedImage(reader.result as string); showToast(t('ai.visionReady'), 'info'); };
    reader.onerror = () => showToast(t('ai.uploadError'), 'error');
    reader.readAsDataURL(file);
  };

  // ── Chat submit
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const currentImg = selectedImage;
    const userMsg: Message = {
      id: Date.now(), role: 'user',
      content: input || (language === 'tr' ? '[Görsel Analizi İstendi]' : '[Image Analysis Requested]'),
      imageAttached: currentImg || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const { reason, durationMins } = parseUserInput(input);
      const result = validateCase(reason, durationMins);
      let response = '';
      let badgeSource = result.categoryMatched || 'CUK Engine';
      const confidenceScore = `%${Math.round(result.score * 100)}`;

      try {
        const token = session?.idToken || '';
        const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
        const res = await fetch(`${baseUrl}/api/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ reason_raw: reason, duration_ms: durationMins ? durationMins * 60000 : 0, image: currentImg || undefined }),
        });
        if (!res.ok) throw new Error(`AI_ENDPOINT_FAILED_${res.status}`);
        const data = await res.json();
        if (data.success && data.analysis) {
          const ai = data.analysis;
          response = result.valid
            ? `[${t('ai.engineVerdict')}] ${t('ai.engineVerdictValid')}\n${t('home.status')}: ${result.categoryMatched}\n\n`
            : `[${t('ai.engineVerdict')}] ${t('ai.engineVerdictInvalid')}\n${t('ai.engineVerdictMsg')}: ${result.message}\n\n`;
          response += `${t('ai.groqReport')}\n`;
          response += `- ${t('ai.groqSummary')}: ${ai.summary || 'N/A'}\n`;
          response += `- ${t('ai.groqRisks')}: ${ai.riskReasons || 'N/A'}\n`;
          response += `- ${t('ai.groqAction')}: ${ai.recommendedAction || 'N/A'}\n`;
          response += `- ${t('ai.groqConfidence')}: ${ai.confidenceNote || 'N/A'}`;
          badgeSource = 'Groq AI + CUK';
        } else throw new Error('AI_INVALID_RESPONSE');
      } catch {
        response = result.valid
          ? `${t('ai.engineVerdictValid')}\n\n${t('home.status')}: ${result.categoryMatched}\n${t('ai.engineVerdictMsg')}: ${result.message}`
          : `${t('ai.engineVerdictInvalid')}\n\n${t('home.status')}: ${result.categoryMatched || 'Tanımsız'}\n${t('ai.engineVerdictMsg')}: ${result.message}`;
        response += `\n\n[Hata] ${t('ai.endpointError')}`;
      }

      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: response, badge: { source: badgeSource, confidence: confidenceScore } }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── DM Send
  const handleDmSend = async () => {
    if (!dmMessage.trim()) { showToast('Mesaj boş olamaz.', 'error'); return; }
    setDmSending(true);
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
      const body: Record<string, unknown> = {
        action: 'dispatch_direct_message',
        guildId: 'dm_only',
        payload: {
          mesaj: dmMessage,
          gonderenAdi: session?.profile?.displayName || 'Yönetim',
          ...(dmTarget === 'role' ? { hedefRol: dmRole } : { hedefKullanici: dmUserId }),
        },
      };
      const res = await fetch(`${baseUrl}/api/admin/discord-bot-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('✅ Mesaj kuyruğa alındı. Bot kısa süre içinde iletecek.', 'success');
      setDmMessage('');
    } catch (err: any) {
      showToast('Mesaj gönderilemedi: ' + err.message, 'error');
    } finally {
      setDmSending(false);
    }
  };

  // ─── TABS ──────────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'chat', label: 'CUK Analiz', icon: Bot },
    { id: 'history', label: 'Sorgu Geçmişi', icon: History },
    ...(isAdmin ? [{ id: 'dm' as TabId, label: 'DM Gönder', icon: MessageSquareDot }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col space-y-4 animate-in">

      {/* Header */}
      <div className="mb-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary" /> {t('ai.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('ai.subtitle')}</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`ai-tab-${id}`}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Chat ──────────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <Card className="flex flex-col overflow-hidden bg-card/80 backdrop-blur-xl border border-border/50" style={{ height: 'calc(100vh - 230px)' }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-5 soft-scroll">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 mt-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border/50 mt-1 overflow-hidden">
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-md' : 'bg-secondary/50 text-foreground border border-border/50 rounded-tl-sm'}`}>
                    {m.imageAttached && (
                      <div className="mb-3 rounded-xl overflow-hidden max-w-sm border border-border/50">
                        <img src={m.imageAttached} alt="Attached screenshot" className="w-full object-cover max-h-48" />
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{m.content}</p>
                    {m.badge && m.role === 'assistant' && (
                      <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{m.badge.source}</Badge>
                        <Badge variant="secondary">{t('pt.reliability')}: {m.badge.confidence}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 mt-1">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50 rounded-tl-sm flex items-center gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="p-4 bg-background border-t border-border/50 space-y-3">
            {selectedImage && (
              <div className="flex items-center gap-3 p-3 bg-secondary/40 border border-border/50 rounded-2xl animate-in slide-in-from-bottom-2">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border shrink-0 relative">
                  <img src={selectedImage} alt="Thumbnail preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setSelectedImage(null)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> {t('ai.visionReady')}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">{t('ai.imageNotSaved')}</span>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className={`shrink-0 p-2.5 transition-colors rounded-xl ${selectedImage ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-secondary text-muted-foreground hover:text-primary'}`}>
                <ImageIcon className="w-4 h-4" />
              </button>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder={t('ai.placeholder')}
                className="flex-1 h-11 bg-card border border-border/50 rounded-2xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground" />
              <button type="submit" disabled={(!input.trim() && !selectedImage) || loading}
                className="shrink-0 p-2.5 text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {t('ai.warning')}
            </div>
          </div>
        </Card>
      )}

      {/* ─── TAB: Query History ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Bot DM üzerinden yapılan AI sorgularının geçmişi.</p>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading} id="ai-history-refresh">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>

          {historyLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : queryLogs.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Henüz sorgu kaydı bulunmuyor.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {queryLogs.map((log) => {
                const meta = log.metadata || {};
                const isExpanded = expandedLog === log.id;
                const verdict = meta.response?.valid;
                return (
                  <Card key={log.id} className="overflow-hidden border border-border/50 hover:border-primary/20 transition-colors">
                    <button
                      id={`ai-log-${log.id}`}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      className="w-full p-4 flex items-start gap-3 text-left"
                    >
                      {/* Verdict indicator */}
                      <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        verdict === true ? 'bg-emerald-500/15 text-emerald-500' :
                        verdict === false ? 'bg-red-500/15 text-red-500' :
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {verdict === true ? <CheckCircle className="w-4 h-4" /> :
                         verdict === false ? <XCircle className="w-4 h-4" /> :
                         <Shield className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{meta.displayName || meta.discordId || 'Bilinmiyor'}</span>
                          {meta.role && <Badge variant="secondary" className="text-xs">{ROLE_LABELS[meta.role] || meta.role}</Badge>}
                          {meta.hasImage && <Badge variant="secondary" className="text-xs">📷 Görsel</Badge>}
                          {verdict !== undefined && (
                            <Badge variant={verdict ? 'success' : 'destructive'} className="text-xs">
                              {verdict ? '✅ Geçerli' : '❌ Geçersiz'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{meta.question || '-'}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(log.created_at)}</span>
                          {meta.quotaLimit !== undefined && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Kota: {(meta.quotaLimit - (meta.quotaLimit - (meta.quotaRemaining ?? 0)))}/{meta.quotaLimit}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0 space-y-3 animate-in slide-in-from-top-1">
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-secondary/40 rounded-xl p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Discord ID</div>
                            <div className="text-sm font-mono">{meta.discordId || '-'}</div>
                          </div>
                          <div className="bg-secondary/40 rounded-xl p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Kategori</div>
                            <div className="text-sm">{meta.response?.categoryMatched || '-'}</div>
                          </div>
                        </div>

                        {meta.question && (
                          <div className="bg-secondary/40 rounded-xl p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Soru / Ceza Sebebi</div>
                            <p className="text-sm whitespace-pre-wrap">{meta.question}</p>
                          </div>
                        )}

                        {meta.response?.summary && (
                          <div className="bg-secondary/40 rounded-xl p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">AI Özet</div>
                            <p className="text-sm">{meta.response.summary}</p>
                          </div>
                        )}

                        {meta.response?.recommendedAction && (
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Önerilen Aksiyon</div>
                            <p className="text-sm">{meta.response.recommendedAction}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Kalan Kota: <strong>{meta.quotaRemaining ?? '?'}/{meta.quotaLimit ?? '?'}</strong></span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: DM Gönder ─────────────────────────────────────────────── */}
      {activeTab === 'dm' && isAdmin && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Bot üzerinden seçilen yetkili veya rütbeye Discord DM mesajı gönder.</p>

          <Card className="p-5 space-y-4">
            {/* Target type selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Hedef Türü</label>
              <div className="flex gap-2">
                <button
                  id="dm-target-role"
                  onClick={() => setDmTarget('role')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${dmTarget === 'role' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border/50 text-muted-foreground hover:text-foreground'}`}
                >
                  <Users className="w-4 h-4" />
                  Rütbeye Göre
                </button>
                <button
                  id="dm-target-user"
                  onClick={() => setDmTarget('user')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${dmTarget === 'user' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border/50 text-muted-foreground hover:text-foreground'}`}
                >
                  <Bot className="w-4 h-4" />
                  Kullanıcıya Özel
                </button>
              </div>
            </div>

            {/* Role selector */}
            {dmTarget === 'role' && (
              <div>
                <label className="block text-sm font-medium mb-2">Hedef Rütbe</label>
                <select
                  id="dm-role-select"
                  value={dmRole}
                  onChange={(e) => setDmRole(e.target.value)}
                  className="w-full h-11 bg-card border border-border/50 rounded-xl px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="all">Tüm Aktif Yetkililer</option>
                  {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
            )}

            {/* User selector */}
            {dmTarget === 'user' && (
              <div>
                <label className="block text-sm font-medium mb-2">Yetkili Seç</label>
                {staffLoading ? (
                  <Skeleton className="h-11 rounded-xl" />
                ) : (
                  <select
                    id="dm-user-select"
                    value={dmUserId}
                    onChange={(e) => setDmUserId(e.target.value)}
                    className="w-full h-11 bg-card border border-border/50 rounded-xl px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="">-- Yetkili seçin --</option>
                    {staffList.map((s) => (
                      <option key={s.discord_id} value={s.discord_id}>
                        {s.display_name} — {ROLE_LABELS[s.staff_rank] || s.staff_rank}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Message textarea */}
            <div>
              <label className="block text-sm font-medium mb-2">Mesaj İçeriği</label>
              <textarea
                id="dm-message-input"
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="Yetkililere iletilecek mesajı buraya yazın..."
                rows={5}
                className="w-full bg-card border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground resize-none"
              />
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>Mesaj Discord DM olarak gönderilecek (Embed formatı)</span>
                <span className={dmMessage.length > 1900 ? 'text-red-500' : ''}>{dmMessage.length}/2000</span>
              </div>
            </div>

            {/* Send button */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Mesaj, yetkililerin Discord gelen kutusuna gönderilecektir.
              </div>
              <Button
                id="dm-send-button"
                onClick={handleDmSend}
                disabled={dmSending || !dmMessage.trim() || (dmTarget === 'user' && !dmUserId)}
                variant="default"
              >
                {dmSending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gönderiliyor...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> DM Gönder</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
