import { useEffect, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Bot, Image as ImageIcon, Send, Sparkles } from 'lucide-react';
import { validateCase, ROLE_HIERARCHY } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  badge?: { source: string; confidence: string };
}

const INITIAL_MESSAGES: Message[] = [{
  id: 0,
  role: 'assistant',
  content: 'Merhaba! Ben CUK karar destek sistemi. Bir ceza sebebi ve süre girerek kurallarla uyumunu test edebilirsiniz. Örnek: "Yetkililere saygısızlık — 12 saat" gibi yazın.',
}];

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

export default function AiAgent() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const avatarUrl = session?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.profile?.discordId || 'user'}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
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
            duration_ms: durationMins ? durationMins * 60000 : 0
          })
        });

        if (!res.ok) {
          throw new Error(`AI_ENDPOINT_FAILED_${res.status}`);
        }

        const data = await res.json();
        if (data.success && data.analysis) {
          const ai = data.analysis;
          if (result.valid) {
            response = `🛡️ [CUK Karar Motoru] Ceza UYGUN.\nKategori: ${result.categoryMatched}\n\n`;
          } else {
            response = `⚠️ [CUK Karar Motoru] KURAL İHLALİ veya EKSİK BİLGİ.\nNeden: ${result.message}\n\n`;
          }
          response += `🤖 [Groq AI Analiz Raporu]\n`;
          response += `• Özet: ${ai.summary || 'Analiz edilemedi.'}\n`;
          response += `• Tespit Edilen Riskler: ${ai.riskReasons || 'Herhangi bir risk tespit edilmedi.'}\n`;
          response += `• Önerilen Aksiyon: ${ai.recommendedAction || 'N/A'}\n`;
          response += `• Güven Notu: ${ai.confidenceNote || 'N/A'}`;
          badgeSource = 'Groq AI + CUK';
        } else {
          throw new Error('AI_INVALID_RESPONSE');
        }
      } catch (aiErr) {
        console.warn('[Lutheus] Groq call failed, falling back to CUK rules engine:', aiErr);
        if (result.valid) {
          response = `Ceza GEÇERLİ görünüyor.\n\nKategori: ${result.categoryMatched}\nMesaj: ${result.message}\nGüven: %${Math.round(result.score * 100)}`;
        } else {
          response = `Ceza HATALI veya eksik bilgi içeriyor.\n\nKategori: ${result.categoryMatched || 'Tanımsız'}\nSebep: ${result.message}`;
        }
        response += `\n\n⚠️ AI Destek Servisi şu an kullanılamıyor (Kota aşılmış veya yetkisiz erişim). Yalnızca yerel CUK motoru sonuçları gösteriliyor.`;
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
          <Bot className="w-7 h-7 text-primary" /> AI Karar Destek
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">CUK kuralları üzerinden ceza türlerini simüle edin.</p>
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
                  <p className="text-sm leading-relaxed">{m.content}</p>
                  {m.badge && m.role === 'assistant' && (
                    <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{m.badge.source}</Badge>
                      <Badge variant="secondary">Güven: {m.badge.confidence}</Badge>
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

        <div className="p-4 bg-background border-t border-border/50">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <button type="button" className="shrink-0 p-2 text-muted-foreground hover:text-primary transition-colors bg-secondary rounded-xl">
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sebep ve süre girin... örn: küfür — 2 saat"
              className="flex-1 h-11 bg-card border border-border/50 rounded-2xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="shrink-0 p-2 text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-center text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            AI can make mistakes. Verify before applying punishment.
          </div>
        </div>
      </Card>
    </div>
  );
}
