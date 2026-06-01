import { useEffect, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Bot, Image as ImageIcon, Send, Sparkles, X, AlertTriangle } from 'lucide-react';
import { validateCase } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  badge?: { source: string; confidence: string };
  imageAttached?: string;
}

export default function AiAgent() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarUrl = session?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.profile?.discordId || 'user'}`;

  // Load welcome message dynamically when t becomes available or language shifts
  useEffect(() => {
    setMessages([
      {
        id: 0,
        role: 'assistant',
        content: t('ai.welcome'),
      }
    ]);
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function parseUserInput(text: string): { reason: string; durationMins: number | null } {
    const reason = text;
    const hourMatch = text.match(/(\d+)\s*(saat|hour)/i);
    const minuteMatch = text.match(/(\d+)\s*(dakika|dk|min)/i);
    const dayMatch = text.match(/(\d+)\s*(gün|gun|day)/i);
    let mins: number | null = null;
    if (dayMatch) mins = Number(dayMatch[1]) * 1440;
    else if (hourMatch) mins = Number(hourMatch[1]) * 60;
    else if (minuteMatch) mins = Number(minuteMatch[1]);
    return { reason, durationMins: mins };
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('ai.uploadError'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      showToast(t('ai.visionReady'), 'info');
    };
    reader.onerror = () => {
      showToast(t('ai.uploadError'), 'error');
    };
    reader.readAsDataURL(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const currentImg = selectedImage;
    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: input || (language === 'tr' ? '[Görsel Analizi İstendi]' : '[Image Analysis Requested]'),
      imageAttached: currentImg || undefined
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
      let confidenceScore = `%${Math.round(result.score * 100)}`;

      try {
        const token = session?.idToken || '';
        const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:')
          ? 'https://lutheus.vercel.app'
          : '';

        const res = await fetch(`${baseUrl}/api/ai/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            reason_raw: reason,
            duration_ms: durationMins ? durationMins * 60000 : 0,
            image: currentImg || undefined
          })
        });

        if (!res.ok) {
          throw new Error(`AI_ENDPOINT_FAILED_${res.status}`);
        }

        const data = await res.json();
        if (data.success && data.analysis) {
          const ai = data.analysis;
          if (result.valid) {
            response = `[${t('ai.engineVerdict')}] ${t('ai.engineVerdictValid')}\n${t('home.status')}: ${result.categoryMatched}\n\n`;
          } else {
            response = `[${t('ai.engineVerdict')}] ${t('ai.engineVerdictInvalid')}\n${t('ai.engineVerdictMsg')}: ${result.message}\n\n`;
          }
          response += `${t('ai.groqReport')}\n`;
          response += `- ${t('ai.groqSummary')}: ${ai.summary || 'N/A'}\n`;
          response += `- ${t('ai.groqRisks')}: ${ai.riskReasons || 'N/A'}\n`;
          response += `- ${t('ai.groqAction')}: ${ai.recommendedAction || 'N/A'}\n`;
          response += `- ${t('ai.groqConfidence')}: ${ai.confidenceNote || 'N/A'}`;
          badgeSource = 'Groq AI + CUK';
        } else {
          throw new Error('AI_INVALID_RESPONSE');
        }
      } catch (aiErr) {
        console.warn('[Lutheus] Groq call failed, falling back to CUK rules engine:', aiErr);
        if (result.valid) {
          response = `${t('ai.engineVerdictValid')}\n\n${t('home.status')}: ${result.categoryMatched}\n${t('ai.engineVerdictMsg')}: ${result.message}\n${t('pt.reliability')}: %${Math.round(result.score * 100)}`;
        } else {
          response = `${t('ai.engineVerdictInvalid')}\n\n${t('home.status')}: ${result.categoryMatched || 'Tanimsiz'}\n${t('ai.engineVerdictMsg')}: ${result.message}`;
        }
        response += `\n\n[Hata] ${t('ai.endpointError')}`;
      }

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        badge: {
          source: badgeSource,
          confidence: confidenceScore,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-110px)] space-y-0 animate-in">
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary" /> {t('ai.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('ai.subtitle')}</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden bg-card/80 backdrop-blur-xl border border-border/50">
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

        {/* Vision Upload UI & Input panel */}
        <div className="p-4 bg-background border-t border-border/50 space-y-3">
          {selectedImage && (
            <div className="flex items-center gap-3 p-3 bg-secondary/40 border border-border/50 rounded-2xl animate-in slide-in-from-bottom-2">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-border shrink-0 relative">
                <img src={selectedImage} alt="Thumbnail preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors"
                >
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
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={triggerFileSelect}
              className={`shrink-0 p-2.5 transition-colors rounded-xl ${selectedImage ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-secondary text-muted-foreground hover:text-primary'}`}
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai.placeholder')}
              className="flex-1 h-11 bg-card border border-border/50 rounded-2xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || loading}
              className="shrink-0 p-2.5 text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            {t('ai.warning')}
          </div>
        </div>
      </Card>
    </div>
  );
}
