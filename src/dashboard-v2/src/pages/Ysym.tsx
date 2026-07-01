import { useEffect, useState, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { supabaseFetch } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import {
  GraduationCap, CheckCircle2, XCircle, Search, Clock, Shield, Sparkles,
  FileText, ChevronDown, Check, X, Star, AlertCircle, Copy, Link2
} from 'lucide-react';

interface YsymSubmission {
  id: string;
  applicant_id: string;
  status: string;
  full_name: string;
  discord_tag: string;
  email: string;
  raw_answers: Record<string, any>;
  ai_score: number | null;
  ai_report: string | null;
  created_at: string;
}

export default function Ysym() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const [submissions, setSubmissions] = useState<YsymSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<YsymSubmission | null>(null);
  const [formConfig, setFormConfig] = useState<any>(null);
  
  // Evaluation States
  const [evaluating, setEvaluating] = useState(false);
  const [manualScore, setManualScore] = useState<number>(75);
  const [feedback, setFeedback] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'success' | 'failed'>('all');
  
  // Soru bazlı puanlar ve notlar
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});

  const userRole = session?.role?.toLowerCase() || '';
  const isMgmt = ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(userRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await supabaseFetch<YsymSubmission[]>('ysym_submissions', 'GET', 'order=created_at.desc');
      if (data) {
        setSubmissions(data);
      }
      
      const formSchema = await supabaseFetch<any[]>('custom_forms', 'GET', 'id=eq.ysym_sinav');
      if (formSchema && formSchema[0]) {
        setFormConfig(formSchema[0]);
      }
    } catch (err: any) {
      showToast('Sınav verileri yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchSearch = !searchQuery || 
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.discord_tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.applicant_id?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchFilter = statusFilter === 'all' ||
        (statusFilter === 'pending' && s.status === 'Beklemede') ||
        (statusFilter === 'success' && s.status === 'Başarılı') ||
        (statusFilter === 'failed' && s.status === 'Başarısız');

      return matchSearch && matchFilter;
    });
  }, [submissions, searchQuery, statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!isMgmt) {
      showToast('Bu işlemi yapmaya yetkiniz bulunmuyor.', 'error');
      return;
    }
    
    setEvaluating(true);
    try {
      // Soru bazlı puan ve notları da raw_answers içine yedekleyelim
      const answersUpdate = {
        ...(selectedSub?.raw_answers || {}),
        question_scores: questionScores,
        question_notes: questionNotes
      };

      await supabaseFetch('ysym_submissions', 'PATCH', `id=eq.${id}`, {
        status: newStatus,
        ai_score: manualScore,
        ai_report: feedback || null,
        raw_answers: answersUpdate
      });

      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, ai_score: manualScore, ai_report: feedback || null, raw_answers: answersUpdate } : s));
      if (selectedSub && selectedSub.id === id) {
        setSelectedSub(prev => prev ? { ...prev, status: newStatus, ai_score: manualScore, ai_report: feedback || null, raw_answers: answersUpdate } : null);
      }
      showToast(`Sınav durumu güncellendi: ${newStatus}`, 'success');
    } catch (err: any) {
      showToast('Güncelleme hatası: ' + err.message, 'error');
    } finally {
      setEvaluating(false);
    }
  };

  // Soru puanları değiştikçe genel puanı otomatik ortalama olarak hesapla
  const handleScoreChange = (fieldId: string, val: number) => {
    if (!isMgmt) return;
    const nextScores = { ...questionScores, [fieldId]: val };
    setQuestionScores(nextScores);

    // Yalnızca geçerli soruların (section_break veya rich_text olmayanların) ortalamasını alalım
    const validQuestions = formConfig?.fields.filter((f: any) => f.type !== 'section_break' && f.type !== 'rich_text') || [];
    if (validQuestions.length > 0) {
      let total = 0;
      let count = 0;
      validQuestions.forEach((q: any) => {
        const score = nextScores[q.id] !== undefined ? nextScores[q.id] : 5; // default 5 puan
        total += score;
        count++;
      });
      const avgPercent = Math.round((total / (count * 10)) * 100);
      setManualScore(avgPercent);
    }
  };

  const handleNoteChange = (fieldId: string, text: string) => {
    if (!isMgmt) return;
    setQuestionNotes(prev => ({ ...prev, [fieldId]: text }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Başarılı':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Başarısız':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'Beklemede':
      default:
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    }
  };

  const copyInviteLink = () => {
    const inviteCode = formConfig?.config?.invite_code || '';
    const origin = window.location.origin;
    const fullLink = `${origin}/ysym-exam?code=${inviteCode}`;
    navigator.clipboard.writeText(fullLink);
    showToast('YSYM Sınavı davet bağlantısı panoya kopyalandı.', 'success');
  };

  return (
    <div className="p-6 md:p-8 w-full">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-purple-400" /> YSYM Yetkilendirme Kontrol Paneli
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Yetkili yeterlilik sınavına giren adayların sınav yanıtlarını inceleyin ve detaylıca değerlendirin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isMgmt && formConfig?.config?.invite_code && (
              <button onClick={copyInviteLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-300 text-xs font-semibold hover:bg-purple-600/20 cursor-pointer">
                <Link2 size={13} /> Davet Linki Kopyala
              </button>
            )}
            <div className="flex flex-wrap gap-1.5 p-1 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              {['all', 'pending', 'success', 'failed'].map((flt) => (
                <button
                  key={flt}
                  onClick={() => setStatusFilter(flt as any)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    statusFilter === flt
                      ? 'bg-purple-600 border-purple-500/30 text-white shadow-sm'
                      : 'bg-transparent border-transparent text-white/40 hover:text-white'
                  }`}
                >
                  {flt === 'all' ? 'Tümü' : flt === 'pending' ? 'Beklemede' : flt === 'success' ? 'Başarılı' : 'Başarısız'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Submissions List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Aday Adı, LID veya Discord ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/40 font-semibold"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Card key={i} className="h-16 bg-black/10 animate-pulse border-white/[0.04]" />)}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <Card className="p-12 text-center border-white/[0.06] bg-black/15">
                <FileText className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-xs text-white/40 font-semibold">Gösterilecek sınav kaydı bulunamadı.</p>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto hide-scrollbar">
                {filteredSubmissions.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setSelectedSub(sub);
                      setManualScore(sub.ai_score || 70);
                      setFeedback(sub.ai_report || '');
                      setQuestionScores(sub.raw_answers?.question_scores || {});
                      setQuestionNotes(sub.raw_answers?.question_notes || {});
                    }}
                    className={`w-full p-4 flex items-center justify-between text-left rounded-2xl border transition-all cursor-pointer ${
                      selectedSub?.id === sub.id
                        ? 'border-purple-500/40 bg-purple-600/[0.03]'
                        : 'border-white/[0.06] bg-black/15 hover:border-white/10'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{sub.full_name}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/5 bg-white/5 text-white/40 font-mono">({sub.applicant_id})</span>
                      </div>
                      <div className="text-[10px] text-white/40 font-mono mt-0.5">@{sub.discord_tag}</div>
                      <div className={`w-fit text-[8px] font-bold px-2 py-0.5 rounded-full border mt-1.5 ${getStatusBadge(sub.status)}`}>
                        {sub.status}
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1 justify-end">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" /> {sub.ai_score != null ? `% ${sub.ai_score}` : 'Notlanmamış'}
                      </div>
                      <div className="text-[9px] text-white/30 font-semibold mt-1 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" /> {formatDate(sub.created_at)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Submission Detail */}
          <div className="lg:col-span-2">
            {selectedSub ? (
              <Card className="p-6 border-white/[0.06] bg-black/15 rounded-3xl space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto hide-scrollbar">
                
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-4 border-b border-white/[0.05]">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{selectedSub.full_name}</h3>
                    <p className="text-[10px] font-mono text-white/40 mt-1">Sınav ID: {selectedSub.applicant_id} • E-Posta: {selectedSub.email}</p>
                  </div>
                  <button
                    onClick={() => setSelectedSub(null)}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!isMgmt && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span><strong>Kısıtlı Yetkili Modu:</strong> Sınav detaylarını inceleyebilirsiniz ancak puan verme ve durum güncelleme yetkiniz bulunmamaktadır.</span>
                  </div>
                )}

                {/* Soru Bazlı Değerlendirme Panel */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                    <GraduationCap size={13} className="text-purple-400" /> Soru Bazlı Değerlendirme & Yanıtlar
                  </h4>
                  
                  <div className="space-y-4">
                    {formConfig ? (
                      formConfig.fields.map((field: any) => {
                        if (field.type === 'section_break') {
                          return (
                            <div key={field.id} className="pt-4 border-t border-white/[0.04]">
                              <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{field.label}</div>
                              {field.help_text && <p className="text-[9px] text-white/30 mt-0.5">{field.help_text}</p>}
                            </div>
                          );
                        }
                        if (field.type === 'rich_text') {
                          return (
                            <div key={field.id} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.02] text-white/50 text-[10px]"
                              dangerouslySetInnerHTML={{ __html: field.content || '' }} />
                          );
                        }

                        const answerVal = selectedSub.raw_answers[field.id];
                        const displayAnswer = Array.isArray(answerVal) ? answerVal.join(', ') : String(answerVal ?? 'Belirtilmemiş');
                        const currentScore = questionScores[field.id] !== undefined ? questionScores[field.id] : 5;
                        const currentNote = questionNotes[field.id] || '';

                        return (
                          <div key={field.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-3">
                            <div className="text-[11px] font-bold text-white/80" dangerouslySetInnerHTML={{ __html: field.label }} />
                            <p className="text-xs font-semibold text-white/70 bg-black/20 p-3 rounded-xl leading-relaxed whitespace-pre-wrap">{displayAnswer}</p>

                            {/* Puanlama ve Not Çubuğu (Sadece Yöneticiler için) */}
                            <div className="pt-2 border-t border-white/[0.03] grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold text-white/30 uppercase">Soru Notu (1 - 10)</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    disabled={!isMgmt}
                                    value={currentScore}
                                    onChange={e => handleScoreChange(field.id, Number(e.target.value))}
                                    className="flex-1 accent-purple-500 cursor-pointer disabled:opacity-40"
                                  />
                                  <span className="text-xs font-bold text-purple-400 shrink-0 w-6 text-right">{currentScore}</span>
                                </div>
                              </div>
                              <div className="md:col-span-2 space-y-1">
                                <span className="text-[9px] font-bold text-white/30 uppercase">Soru İnceleme Notu</span>
                                <input
                                  type="text"
                                  disabled={!isMgmt}
                                  placeholder="Cevap hakkında kısa değerlendirme notu girin..."
                                  value={currentNote}
                                  onChange={e => handleNoteChange(field.id, e.target.value)}
                                  className="w-full h-7 px-2.5 rounded-lg bg-white/5 border border-white/[0.04] text-xs text-white outline-none focus:border-purple-500/40 disabled:opacity-40"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Fallback if formConfig fails to load
                      Object.entries(selectedSub.raw_answers).map(([key, val]) => {
                        if (['email', 'full_name', 'discord_tag', 'question_scores', 'question_notes'].includes(key)) return null;
                        return (
                          <div key={key} className="space-y-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                            <div className="text-[9px] font-bold text-purple-400">{key}</div>
                            <p className="text-xs font-semibold text-white/80 leading-relaxed whitespace-pre-wrap">{String(val)}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Sınav Genel Değerlendirme & Sonuç (Sadece Yöneticiler için aktif) */}
                <div className="space-y-4 pt-4 border-t border-white/[0.05]">
                  <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sınav Genel Değerlendirmesi</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-white/40 uppercase">Genel Başarı Yüzdesi (% {manualScore})</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!isMgmt}
                        value={manualScore}
                        onChange={(e) => setManualScore(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/40 font-bold disabled:opacity-40"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-white/40 uppercase">Genel Geri Bildirim Notu</label>
                      <textarea
                        rows={3}
                        disabled={!isMgmt}
                        placeholder="Adayın sınav geneline dair notları veya mülakat daveti detayları..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full bg-white/5 border border-white/[0.06] focus:border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none font-medium leading-relaxed disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {isMgmt && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        disabled={evaluating}
                        onClick={() => handleUpdateStatus(selectedSub.id, 'Başarısız')}
                        className="h-10 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <XCircle className="w-4 h-4" /> Sınavı Reddet (Başarısız)
                      </button>
                      <button
                        disabled={evaluating}
                        onClick={() => handleUpdateStatus(selectedSub.id, 'Başarılı')}
                        className="h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-[0_0_15px_0_rgba(16,185,129,0.15)]"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Sınavı Onayla (Başarılı)
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center border-dashed border-white/[0.06] bg-transparent rounded-3xl">
                <GraduationCap className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-xs text-white/35 font-semibold leading-relaxed">Detayları incelemek, soru bazlı puanlamak<br/>ve notlandırmak için listeden bir sınav seçin.</p>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
