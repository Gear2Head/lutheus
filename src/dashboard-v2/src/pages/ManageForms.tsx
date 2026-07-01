import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { useToast } from '../contexts/ToastContext';
import { supabaseFetch } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import RichTextEditor from '../components/ui/RichTextEditor';
import { motion, AnimatePresence } from 'motion/react';


import {
  Settings, Plus, Trash2, Save, FileText, GraduationCap, ChevronUp, ChevronDown,
  Image, MessageSquare, Type, AlignLeft, ToggleLeft, Star, Sliders,
  Calendar, Clock, Upload, Layers, Eye, EyeOff, CheckSquare, List,
  Palette, X, Copy, GripVertical, Settings2, BarChart2, Bot, AlertTriangle, RefreshCw

} from 'lucide-react';

type FieldType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'rating' | 'scale' | 'date' | 'time' | 'file' | 'section_break' | 'rich_text';

interface FormField {
  id: string; label: string; type: FieldType; required: boolean;
  options?: string[]; placeholder?: string; help_text?: string; content?: string;
  min_value?: number; max_value?: number; min_label?: string; max_label?: string;
  allow_multiple?: boolean; max_files?: number;
}
interface FormConfig {
  banner_url?: string;
  success_message?: string;
  bg_color?: string;
  accent_color?: string;
  intro_html?: string;
  invite_code?: string;
  is_active?: boolean;
}
interface CustomForm { id: string; title: string; description: string; fields: FormField[]; config?: FormConfig; }

const SUPABASE_URL = 'https://jxhzhaqqtlynbnntwpyu.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI';


const FIELD_TYPES: { value: FieldType; label: string; icon: any }[] = [
  { value: 'text', label: 'Kısa Yanıt', icon: Type },
  { value: 'textarea', label: 'Paragraf', icon: AlignLeft },
  { value: 'select', label: 'Açılır Menü', icon: List },
  { value: 'radio', label: 'Çoktan Seçmeli', icon: ToggleLeft },
  { value: 'checkbox', label: 'Onay Kutuları', icon: CheckSquare },
  { value: 'rating', label: 'Yıldız Oylaması', icon: Star },
  { value: 'scale', label: 'Doğrusal Ölçek', icon: Sliders },
  { value: 'date', label: 'Tarih', icon: Calendar },
  { value: 'time', label: 'Saat', icon: Clock },
  { value: 'file', label: 'Dosya Yükleme', icon: Upload },
  { value: 'section_break', label: 'Bölüm Ayracı', icon: Layers },
  { value: 'rich_text', label: 'Zengin Metin', icon: FileText },
];

const ACCENT_PRESETS = ['#673AB7', '#5E5CE6', '#A259FE', '#FF453A', '#FF9F0A', '#32D74B', '#0A84FF', '#BF5AF2', '#FF375F'];
const BG_PRESETS = ['#0f0d13', '#050506', '#0D0D11', '#111118', '#0a0a14', '#100a14'];

function genId() { return `field_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

async function uploadImageToSupabase(file: File, path: string): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const MAX = 1200;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/webp', 0.8));
    const webpPath = path.replace(/\.[^.]+$/, '.webp');
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/form-assets/${webpPath}`, {
      method: 'POST', headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' }, body: blob
    });
    if (res.ok) {
      return `${SUPABASE_URL}/storage/v1/object/public/form-assets/${webpPath}`;
    }
  } catch (e: any) {
    console.warn('Supabase storage upload failed, using Base64 DataURL fallback:', e);
  }

  // Fallback: convert directly to base64 data url
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}


function ColorDot({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-6 h-6 rounded-lg border-2 transition-all cursor-pointer hover:scale-110 active:scale-95 ${active ? 'border-white scale-110' : 'border-transparent'}`}
      style={{ backgroundColor: color }} />
  );
}

function UploadZone({ label, currentUrl, onUpload }: { label: string; currentUrl: string; onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true); setProgress(10);
    try {
      const path = `banners/${Date.now()}_${file.name}`; setProgress(40);
      const url = await uploadImageToSupabase(file, path); setProgress(100); onUpload(url);
    } catch (e: any) { console.error('Upload error:', e); }
    finally { setTimeout(() => { setUploading(false); setProgress(0); }, 600); }
  };

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{label}</label>
      <div className="relative border border-white/[0.08] bg-white/[0.02] rounded-2xl overflow-hidden cursor-pointer hover:border-purple-500/30 hover:bg-purple-500/[0.02] transition-all group" style={{minHeight:100}}
        onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        {currentUrl ? (
          <><img src={currentUrl} alt="banner" className="w-full h-24 object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Upload size={18} className="text-white" /></div></>
        ) : (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <Upload size={18} className="text-white/20 group-hover:text-purple-400 transition-colors" />
            <span className="text-[10px] font-bold text-white/40 group-hover:text-white/60 transition-colors text-center px-4">Görsel Seçin veya Buraya Sürükleyin</span>
            <span className="text-[8px] text-white/20">WebP • Max 5MB</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2">
            <div className="w-3/4 h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-purple-600 rounded-full transition-all duration-300" style={{width:`${progress}%`}} /></div>
            <span className="text-[9px] text-white/60 font-mono">Yükleniyor... %{progress}</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {currentUrl && <button type="button" onClick={() => onUpload('')} className="text-[9px] text-white/30 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"><X size={10} />Görseli Kaldır</button>}
    </div>
  );
}

function FieldIcon({ type }: { type: FieldType }) {
  const entry = FIELD_TYPES.find(t => t.value === type);
  if (!entry) return null;
  const Icon = entry.icon;
  return <Icon size={13} className="text-white/40 shrink-0" />;
}

export default function ManageForms() {
  const { showToast } = useToast();
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('yetkili_alim');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFieldIdx, setSelectedFieldIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [config, setConfig] = useState<FormConfig>({});
  
  // AI and delete state variables
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMode, setAiMode] = useState<'quick' | 'full'>('quick');
  const [aiExamTopics, setAiExamTopics] = useState('');
  const [aiExamSections, setAiExamSections] = useState('3');
  const [aiExamQPerSection, setAiExamQPerSection] = useState('4');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Google Forms Tabs
  const [activeTab, setActiveTab] = useState<'questions' | 'responses' | 'settings'>('questions');
  const [responsesCount, setResponsesCount] = useState(0);
  const [rawResponses, setRawResponses] = useState<any[]>([]);
  const [responsesTab, setResponsesTab] = useState<'summary' | 'question' | 'individual'>('summary');
  const [currentResponseIdx, setCurrentResponseIdx] = useState(0);
  const [selectedResponseQuestionId, setSelectedResponseQuestionId] = useState<string>('');


  useEffect(() => {
    (async () => {
      try {
        const data = await supabaseFetch<CustomForm[]>('custom_forms', 'GET');
        if (data) {
          setForms(data);
          const cur = data.find(f => f.id === selectedFormId);
          if (cur) {
            applyForm(cur);
            if (cur.fields && cur.fields.length > 0) {
              setSelectedResponseQuestionId(cur.fields[0].id);
            }
          } else {
            setTitle(selectedFormId === 'yetkili_alim' ? 'Lutheus | Discord Moderasyon Başvuru Formu' : 'Lutheus | YSYM Sınavı');
            setDescription('');
            setFields([]);
            setConfig({});
            setSelectedFieldIdx(null);
          }
        }

        
        // Load actual responses data
        const subTable = selectedFormId === 'yetkili_alim' ? 'staff_applications' : 'ysym_submissions';
        const resData = await supabaseFetch<any[]>(subTable, 'GET', 'order=created_at.desc');
        if (resData) {
          setRawResponses(resData);
          setResponsesCount(resData.length);
        } else {
          setRawResponses([]);
          setResponsesCount(0);
        }

      } catch { showToast('Formlar yüklenirken hata oluştu.', 'error'); }
      finally { setLoading(false); }
    })();
  }, [selectedFormId]);


  const loadLutheusDefaultTemplate = () => {
    if (selectedFormId === 'yetkili_alim') {
      setTitle('Lutheus | Discord Moderasyon Başvuru Formu');
      setDescription('İlgili soruları detaylı ve eksiksiz doldurmanız istenir. Discord Yönetim Ekibi üyelerimiz ilgili başvuru formunuzu inceleyecek ve kabul görürseniz Lutheus | Discord adresi üzerinden sizlerle iletişime geçecektir.');
      setConfig({
        is_active: true,
        bg_color: '#0f0d13',
        accent_color: '#673AB7',
        success_message: 'Başvurunuz başarıyla kaydedilmiştir. İnceleme süreci sonrası Discord üzerinden bilgilendirme alacaksınız.',
        banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop'
      });
      setFields([
        { id: 'field_email', label: 'E-Posta Adresiniz', type: 'text', required: true, help_text: 'Sizinle iletişim kurabileceğimiz aktif e-posta adresi.' },
        { id: 'field_name', label: 'Adınız ve Soyadınız', type: 'text', required: true },
        { id: 'field_birth', label: 'Doğum Tarihiniz (Gün/Ay/Yıl)', type: 'date', required: true },
        { id: 'field_discord', label: 'Discord ID / Username', type: 'text', required: true },
        { id: 'field_penalty', label: 'Lutheus Discord sunucumuzda daha önce cezai işlem (Mute - Ban vb.) aldınız mı? Aldıysanız sebebi neydi?', type: 'textarea', required: true },
        { id: 'field_mic', label: 'Çalışan bir mikrofonunuz varsa ses kalitesini 10 üzerinden puanlayınız.', type: 'scale', required: false, min_value: 1, max_value: 10, help_text: 'Aktif bir mikrofonunuz yoksa lütfen soruyu yanıtlamayınız.' },
        { id: 'field_motivation', label: 'Lutheus Discord Moderasyon ekibimize neden katılmak istiyorsunuz?', type: 'textarea', required: true, help_text: 'Sizi diğer adaylardan ayıracak olan özel yeteneğiniz veya motivasyonunuz nedir?' },
        { id: 'field_teamwork', label: 'Ekip çalışması ve ekip içi iletişim sizin için neyi ifade ediyor?', type: 'textarea', required: true, help_text: 'Kısa, özgün olmayan ve uygunsuz dil kullanımı içeren paragraflar kabul edilemez.' },
        { id: 'field_aim', label: 'Size göre moderasyon süreçlerinin temel amacı nedir?', type: 'textarea', required: true, help_text: 'Topluluğun korunması, yazılı ve sesli kanalların düzeni veya kullanıcı geri bildirimlerinin işlenmesi gibi konularda bir paragraf yazabilirsiniz.' },
        { id: 'field_experience', label: 'Deneyimleriniz nelerdir? (Herhangi bir sunucuda yetkili oldunuz mu, kendiniz sunucu kurdunuz mu?)', type: 'textarea', required: true, help_text: 'Kurduğunuz veya yetkili olduğunuz sunucunun/sunucuların adını ve davet bağlantısını yazarak bilgiler veriniz.' },
        { id: 'field_regret', label: 'Daha önce herhangi bir yerde yetki sahibi bir konumda olduysanız ilgili sunucuda aldığınız bir karardan (mute, ban vb.) dolayı hiç pişman oldunuz mu? Olduysanız neden?', type: 'textarea', required: true, help_text: 'Eğer olmadıysanız, olmadığınızı belirterek soruyu atlayabilirsiniz.' },
        { id: 'field_hours', label: 'Sunucuya ayırabileceğiniz süre zarfı nedir?', type: 'radio', required: true, options: ['2 - 3', '3 - 6', '6 - 12+'], help_text: 'Belirtilen seçenekler saat olarak baz alınır.' },
        { id: 'field_timewindows', label: 'Sunucuya en fazla zaman ayırabileceğiniz süreler hangi zaman dilimleri içerisindedir?', type: 'checkbox', required: true, options: ['Sabah', 'Öğlen', 'Akşam', 'Gece'] },
        
        { id: 'field_sec_break', label: 'Bölüm 3/3: Senaryo ve Durum Soruları', type: 'section_break', required: false, help_text: 'Bu bölümde sizlere spesifik örnekler içeren sorular yönlendireceğiz, soruları dikkatlice okuyarak ve yorumlayarak yanıtlayınız.' },
        { id: 'field_profile', label: 'Yeni gelen bir üyenin sunucuya ilk adım attığında gördüğü yetkili profili sizce nasıl olmalıdır?', type: 'textarea', required: true },
        { id: 'field_stress', label: 'Stresli veya yoğun dönemlerde nasıl bir iletişim tarzı benimsersiniz?', type: 'textarea', required: false },
        { id: 'field_chat', label: 'Bir üye, genel sohbette tartışmalı ve hassas bir konuda sohbet başlatıyor. Ne gibi aksiyon alırdınız?', type: 'textarea', required: false },
        { id: 'field_tense', label: 'Aşırı gergin bir kullanıcı sadece dert yanıyor ama hakaret etmiyor. Kullanıcıya karşı yaklaşımınız nasıl olurdu?', type: 'textarea', required: false },
        { id: 'field_friend', label: 'Lutheus Minecraft sunucusunda genel sohbet üzerinde yakın bir arkadaşınız kurallara aykırı davranıyor, nasıl bir aksiyon alırdınız?', type: 'textarea', required: true, help_text: 'Yanıtlarken ilgili süreç boyunca aktif tek moderasyon üyesinin siz olduğunuzu düşünün.' },
        { id: 'field_unacceptable', label: 'Size göre bir toplulukta/sunucuda asla müsamaha gösterilmemesi ve direkt sunucudan uzaklaştırılması gereken ilk 3 şey nedir?', type: 'textarea', required: false },
        { id: 'field_additional', label: 'Son olarak eklemek istediğiniz bir şeyler var mı?', type: 'textarea', required: false },
        { id: 'field_consent', label: 'Başvuru Bilgilendirmesi', type: 'checkbox', required: true, options: ['Başvuru süreci dahilinde bilgilerimin bir elektronik tabloda saklanmasını onaylıyorum.'] }
      ]);
      showToast('Lutheus Yetkili Alım Formu şablonu başarıyla yüklendi! Lütfen kaydet butonuna basarak kaydedin.', 'success');
    } else {
      setTitle('Lutheus | YSYM Sınavı');
      setDescription('Yönetim ekibi yeterlilik sınavı formudur.');
      setFields([
        { id: 'field_ysym_name', label: 'Adınız ve Soyadınız', type: 'text', required: true },
        { id: 'field_ysym_discord', label: 'Discord Kullanıcı Adınız', type: 'text', required: true }
      ]);
      showToast('Lutheus YSYM Sınavı standart şablonu başarıyla yüklendi! Lütfen kaydet butonuna basarak kaydedin.', 'success');
    }
  };

  const handleExportCSV = () => {
    if (rawResponses.length === 0) {
      showToast('İndirilecek herhangi bir yanıt bulunmuyor.', 'error');
      return;
    }
    
    const headers = ['Aday ID', 'Adı Soyadı', 'Discord Tag', 'E-posta', 'Gönderim Tarihi', 'Durum'];
    fields.forEach(f => {
      if (f.type !== 'section_break' && f.type !== 'rich_text') {
        headers.push(f.label.replace(/,/g, ' '));
      }
    });

    const csvRows = [headers.join(',')];

    rawResponses.forEach(r => {
      const row = [
        r.applicant_id,
        `"${(r.full_name || '').replace(/"/g, '""')}"`,
        `"${(r.discord_tag || '').replace(/"/g, '""')}"`,
        r.email,
        r.created_at,
        r.status || 'Bekliyor'
      ];

      fields.forEach(f => {
        if (f.type !== 'section_break' && f.type !== 'rich_text') {
          const val = r.raw_answers?.[f.id] !== undefined ? r.raw_answers[f.id] : r.raw_answers?.[f.label];
          const displayVal = Array.isArray(val) ? val.join('; ') : String(val ?? '');
          row.push(`"${displayVal.replace(/"/g, '""')}"`);
        }
      });

      csvRows.push(row.join(','));
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedFormId}_yanitlar.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Yanıtlar CSV olarak başarıyla indirildi.', 'success');
  };

  const handleClearAllResponses = async () => {
    if (!window.confirm('Bu forma gelen tüm yanıtları veritabanından kalıcı olarak temizlemek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    const subTable = selectedFormId === 'yetkili_alim' ? 'staff_applications' : 'ysym_submissions';
    setSaving(true);
    try {
      await supabaseFetch(subTable, 'DELETE', 'applicant_id=neq.NULL');
      showToast('Tüm yanıtlar veritabanından başarıyla temizlendi.', 'success');
      setRawResponses([]);
      setResponsesCount(0);
      setCurrentResponseIdx(0);
    } catch (e: any) {
      showToast(`Yanıtlar temizlenemedi: ${e.message || String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateIndividualResponseStatus = async (applicantId: string, newStatus: string) => {
    const subTable = selectedFormId === 'yetkili_alim' ? 'staff_applications' : 'ysym_submissions';
    try {
      await supabaseFetch(subTable, 'PATCH', `applicant_id=eq.${applicantId}`, { status: newStatus });
      
      const scriptUrl = localStorage.getItem('lutheus-google-script-url');
      if (scriptUrl) {
        const executorName = 'Web Panel Admin';
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateStatus',
            applicantId,
            status: newStatus,
            executorName
          })
        }).catch(err => console.warn('Discord webhook notification failed:', err));
      }

      showToast(`Aday durumu güncellendi: ${newStatus}`, 'success');
      setRawResponses(prev => prev.map(r => r.applicant_id === applicantId ? { ...r, status: newStatus } : r));
    } catch (err: any) {
      showToast('Durum güncellenirken hata oluştu: ' + err.message, 'error');
    }
  };


  const handleDeleteIndividualResponse = async (applicantId: string) => {
    if (!window.confirm('Bu adayın yanıtını veritabanından tamamen silmek istediğinize emin misiniz?')) return;
    const subTable = selectedFormId === 'yetkili_alim' ? 'staff_applications' : 'ysym_submissions';
    try {
      await supabaseFetch(subTable, 'DELETE', `applicant_id=eq.${applicantId}`);
      showToast('Yanıt başarıyla silindi.', 'success');
      setRawResponses(prev => prev.filter(r => r.applicant_id !== applicantId));
      setResponsesCount(prev => Math.max(0, prev - 1));
      setCurrentResponseIdx(0);
    } catch (err: any) {
      showToast('Silme işlemi başarısız: ' + err.message, 'error');
    }
  };


  const applyForm = (f: CustomForm) => {
    setTitle(f.title); setDescription(f.description);
    setFields(f.fields || []); setConfig(f.config || {});
    setSelectedFieldIdx(null);
    // Sync is_exam_visible to localStorage so YsymExam can read it immediately
    if (f.id === 'ysym_sinav') {
      const visible = (f.config as any)?.is_exam_visible !== false;
      localStorage.setItem('ysym-is-exam-visible', String(visible));
    }
  };



  const handleGenerateQuestionsWithAI = async (promptOverride?: string) => {
    const prompt = promptOverride ?? aiPrompt;
    if (!prompt.trim()) return;
    let apiKey = (import.meta.env.VITE_GROQ_API_KEY || '').trim();
    if (!apiKey) {
      apiKey = (localStorage.getItem('lutheus-custom-groq-key') || '').trim();
    }
    if (!apiKey) {
      showToast('Groq API Key (VITE_GROQ_API_KEY) bulunamadı. Lütfen .env dosyasını kontrol edin veya Ayarlar sayfasından özel anahtar tanımlayın.', 'error');
      return;
    }
    setAiGenerating(true);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'system',
              content: 'Sen profesyonel bir sınav, form ve anket yapay zeka asistanısın. Kullanıcı senden bir sınav/form oluşturmanı istediğinde, sadece ama sadece geçerli bir JSON array formatında soru listesi döndürsün. Geriye başka hiçbir şey yazma. Markdown kod blokları (```json veya ```) kullanma, sadece saf JSON dizi stringi olarak döndür. Array elemanları şu alanları içermelidir: { label: string, type: "text" | "textarea" | "radio" | "checkbox" | "scale" | "select" | "section_break" | "rich_text", options?: string[], help_text?: string, content?: string }.'
            },
            {
              role: 'user',
              content: `Lütfen şu istek için form soruları ve bölüm ayrımları üret. İstek: ${prompt}`
            }
          ],
          temperature: 0.65,
          max_tokens: 2500
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API returned HTTP ${response.status}`);
      }

      const responseData = await response.json();
      const content = responseData.choices?.[0]?.message?.content || '';
      
      let cleanJsonStr = content.trim();
      if (cleanJsonStr.startsWith('```')) {
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const generatedQuestions = JSON.parse(cleanJsonStr);
      if (Array.isArray(generatedQuestions)) {
        const newFields: FormField[] = generatedQuestions.map((q: any) => ({
          id: `field_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          label: q.label || 'Soru / Bölüm Başlığı',
          type: q.type || 'text',
          required: q.type !== 'section_break' && q.type !== 'rich_text' ? (q.required !== false) : false,
          options: q.options || [],
          placeholder: q.placeholder || '',
          help_text: q.help_text || '',
          content: q.content || ''
        }));
        
        setFields(prev => [...prev, ...newFields]);
        showToast(`AI ile ${newFields.length} adet yeni soru ve bölüm başarıyla üretildi!`, 'success');
        setAiPrompt('');
        setAiModalOpen(false);
      } else {
        throw new Error('Response is not a valid JSON array');
      }
    } catch (e: any) {
      console.error('[Groq AI Error]', e);
      showToast(`AI soru üretimi başarısız: ${e.message || String(e)}`, 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleFormDelete = async () => {
    if (!selectedFormId) return;
    setSaving(true);
    try {
      await supabaseFetch('custom_forms', 'DELETE', `id=eq.${selectedFormId}`);
      showToast('Form başarıyla veritabanından tamamen silindi.', 'success');
      setDeleteConfirmOpen(false);
      window.location.reload();
    } catch (e: any) {
      showToast(`Form silinemedi: ${e.message || String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };


  const handleFormSelect = (id: string) => {
    setSelectedFormId(id);
  };

  const addField = (type: FieldType = 'text') => {
    const defaults: Partial<FormField> = {};
    if (['select','radio','checkbox'].includes(type)) defaults.options = ['Seçenek 1','Seçenek 2'];
    if (type === 'scale') { defaults.min_value = 1; defaults.max_value = 10; defaults.min_label = 'Hiç'; defaults.max_label = 'Çok'; }
    const newField: FormField = { id: genId(), label: 'Yeni Soru', type, required: false, ...defaults };
    setFields(prev => {
      const next = [...prev, newField];
      setSelectedFieldIdx(next.length - 1);
      return next;
    });
  };

  const updateField = useCallback((idx: number, patch: Partial<FormField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }, []);

  const removeField = (idx: number) => { setFields(prev => prev.filter((_,i) => i !== idx)); setSelectedFieldIdx(null); };

  const moveField = (idx: number, dir: 'up'|'down') => {
    const ni = dir === 'up' ? idx-1 : idx+1;
    if (ni < 0 || ni >= fields.length) return;
    const u = [...fields]; [u[idx],u[ni]] = [u[ni],u[idx]]; setFields(u); setSelectedFieldIdx(ni);
  };

  const duplicateField = (idx: number) => {
    const copy = { ...fields[idx], id: genId() };
    const next = [...fields]; next.splice(idx+1, 0, copy); setFields(next); setSelectedFieldIdx(idx+1);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = await supabaseFetch<CustomForm[]>('custom_forms', 'GET', `id=eq.${selectedFormId}`);
      
      if (existing && existing.length > 0) {
        await supabaseFetch('custom_forms', 'PATCH', `id=eq.${selectedFormId}`, { title, description, fields, config });
      } else {
        await supabaseFetch('custom_forms', 'POST', '', { id: selectedFormId, title, description, fields, config });
      }

      setForms(prev => {
        const hasIt = prev.some(f => f.id === selectedFormId);
        if (hasIt) {
          return prev.map(f => f.id === selectedFormId ? {...f, title, description, fields, config} : f);
        } else {
          return [...prev, { id: selectedFormId, title, description, fields, config }];
        }
      });
      
      if (selectedFormId === 'ysym_sinav') {
        localStorage.setItem('ysym-is-exam-visible', String((config as any).is_exam_visible !== false));
      }
      if (selectedFormId === 'yetkili_alim') {
        localStorage.setItem('apply-is-active', String(config.is_active !== false));
      }

      showToast('Form yapısı veritabanına başarıyla kaydedildi.', 'success');
    } catch (err: any) { showToast('Kaydetme hatası: ' + err.message, 'error'); }
    finally { setSaving(false); }
  };



  return (
    <div className="w-full min-h-screen text-white/90 font-sans" style={{ backgroundColor: config.bg_color || '#0f0d13' }}>
      {/* Accent top border */}
      <div className="h-1.5 w-full" style={{ backgroundColor: config.accent_color || '#673AB7' }} />
      
      {/* Top Navigation — Google Forms style sticky header */}
      <div className="border-b border-white/[0.06] bg-black/60 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5">
          {/* Left: form icon + name + form switcher */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: (config.accent_color || '#673AB7') + '25', border: `1px solid ${(config.accent_color || '#673AB7')}40` }}>
              <FileText size={16} style={{ color: config.accent_color || '#A78BFA' }} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white leading-tight truncate max-w-[160px]">{title || 'Form Adı Belirtilmemiş'}</h2>
              <p className="text-[9px] text-white/30">Form Editörü</p>
            </div>
            <div className="flex p-0.5 bg-white/[0.04] border border-white/[0.07] rounded-xl ml-2">
              {forms.map(f => (
                <button key={f.id} onClick={() => handleFormSelect(f.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                  style={selectedFormId === f.id ? { backgroundColor: (config.accent_color || '#673AB7') + '30', color: config.accent_color || '#A78BFA', border: `1px solid ${(config.accent_color || '#673AB7')}35` } : { color: 'rgba(255,255,255,0.35)' }}
                >
                  {f.id === 'yetkili_alim' ? 'Başvuru Formu' : 'YSYM Sınavı'}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Tab switcher */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            {[
              { key: 'questions', icon: Type, label: 'Sorular' },
              { key: 'responses', icon: BarChart2, label: 'Yanıtlar', badge: responsesCount },
              { key: 'settings', icon: Settings2, label: 'Ayarlar' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                style={activeTab === tab.key
                  ? { backgroundColor: config.accent_color || '#673AB7', color: '#fff', boxShadow: `0 0 16px ${(config.accent_color || '#673AB7')}50` }
                  : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                <tab.icon size={13} />
                {tab.label}
                {tab.badge !== undefined && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>{tab.badge}</span>}
              </button>
            ))}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadLutheusDefaultTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all"
              style={{ backgroundColor: (config.accent_color || '#673AB7') + '12', borderColor: (config.accent_color || '#673AB7') + '30', color: config.accent_color || '#A78BFA' }}
              title="Hazır şablonu yükle"
            >
              <RefreshCw size={13} /> Şablon
            </button>

            <button type="button" onClick={() => setDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold cursor-pointer transition-all"
            >
              <Trash2 size={13} /> Sil
            </button>

            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
              style={{ backgroundColor: config.accent_color || '#673AB7', boxShadow: `0 0 20px ${(config.accent_color || '#673AB7')}40` }}
            >
              <Save size={13} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 relative">
        
        {/* TABS 1: SORULAR (QUESTIONS) */}
        {activeTab === 'questions' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            
            {/* Title Card — Google Forms style with thick top border */}
            <div
              className="rounded-2xl overflow-hidden shadow-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderTop: `6px solid ${config.accent_color || '#673AB7'}`,
              }}
            >
              {config.banner_url && (
                <div className="w-full h-40 overflow-hidden">
                  <img src={config.banner_url} alt="banner" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6 space-y-3">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Form Başlığı"
                  className="w-full bg-transparent border-0 border-b-2 focus:outline-none text-white text-2xl font-bold pb-2 transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  onFocus={e => (e.target.style.borderColor = config.accent_color || '#673AB7')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Form açıklaması (isteğe bağlı)..."
                  rows={2}
                  className="w-full bg-transparent border-0 border-b focus:outline-none text-white/60 text-sm pb-2 resize-none transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                  onFocus={e => (e.target.style.borderColor = config.accent_color || '#673AB7')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')}
                />
              </div>
            </div>

            {/* Layout Grid: Questions + Right Toolbar */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_56px] gap-3 items-start">
              
              {/* Questions List */}
              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const isSelected = selectedFieldIdx === idx;
                  const accent = config.accent_color || '#673AB7';
                  return (
                    <div
                      key={field.id}
                      onClick={() => setSelectedFieldIdx(idx)}
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? accent + '60' : 'rgba(255,255,255,0.05)'}`,
                        borderLeft: isSelected ? `4px solid ${accent}` : '4px solid transparent',
                        borderRadius: '12px',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        boxShadow: isSelected ? `0 0 20px ${accent}15` : 'none',
                      }}
                    >
                      {/* Drag handle bar */}
                      <div className="flex items-center justify-between px-4 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <div className="flex items-center gap-0.5">
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveField(idx, 'up'); }} disabled={idx === 0} className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white disabled:opacity-20 cursor-pointer transition-colors" title="Yukarı Taşı">
                            <ChevronUp size={12} />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveField(idx, 'down'); }} disabled={idx === fields.length - 1} className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white disabled:opacity-20 cursor-pointer transition-colors" title="Aşağı Taşı">
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <GripVertical size={12} className="text-white/20" />
                        <span className="text-[8px] font-mono text-white/15">#{idx + 1}</span>
                      </div>

                      <div className="px-6 pb-6 pt-1 space-y-4">

                      {/* Kart İçinde Düzenleme Satırı (Google Forms Gibi Seçili Karta Detayları Açılır) */}
                      {isSelected ? (
                        <div className="space-y-4 animate-in fade-in duration-150">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input value={field.label} onChange={e => updateField(idx, { label: e.target.value })} placeholder="Soru Başlığı" className="flex-1 bg-transparent border-0 border-b border-white/10 focus:border-b-2 focus:border-purple-600 rounded-none px-0 py-2.5 text-sm font-semibold text-white outline-none transition-all" />

                            <select value={field.type} onChange={e => {
                              const nt = e.target.value as FieldType;
                              const p: Partial<FormField> = { type: nt };
                              if (['select','radio','checkbox'].includes(nt) && !field.options) p.options = ['Seçenek 1', 'Seçenek 2'];
                              if (nt === 'scale') { p.min_value = 1; p.max_value = 10; }
                              updateField(idx, p);
                            }} className="w-full sm:w-44 bg-white/5 border border-white/[0.06] rounded-xl px-2.5 py-2 text-xs text-white outline-none cursor-pointer">
                              {FIELD_TYPES.map(t => <option key={t.value} value={t.value} className="bg-neutral-900">{t.label}</option>)}
                            </select>
                          </div>

                          {/* Field specific configuration options */}
                          {['select', 'radio', 'checkbox'].includes(field.type) && (
                            <div className="space-y-2 pt-1">
                              <label className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Seçenek Değerleri</label>
                              <div className="space-y-1.5">
                                {(field.options || []).map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                    <input value={opt} onChange={e => { const n = [...(field.options || [])]; n[oi] = e.target.value; updateField(idx, { options: n }); }} className="flex-1 bg-transparent border-b border-white/[0.08] focus:border-purple-500 text-xs text-white outline-none py-0.5" />
                                    <button type="button" onClick={() => { const n = (field.options || []).filter((_, i) => i !== oi); updateField(idx, { options: n }); }} className="p-1 text-white/20 hover:text-rose-400 cursor-pointer transition-colors"><X size={12}/></button>
                                  </div>
                                ))}
                                <button type="button" onClick={() => updateField(idx, { options: [...(field.options || []), `Seçenek ${(field.options?.length || 0) + 1}`] })} className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer transition-colors font-semibold"><Plus size={11}/>Seçenek Ekle</button>
                              </div>
                            </div>
                          )}

                          {field.type === 'scale' && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1"><label className="text-[8px] text-white/25 uppercase">Aralık Min</label><input type="number" value={field.min_value ?? 1} onChange={e => updateField(idx, { min_value: Number(e.target.value) })} className="w-full h-8 px-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/50" /></div>
                              <div className="space-y-1"><label className="text-[8px] text-white/25 uppercase">Aralık Max</label><input type="number" value={field.max_value ?? 10} onChange={e => updateField(idx, { max_value: Number(e.target.value) })} className="w-full h-8 px-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/50" /></div>
                              <div className="space-y-1"><label className="text-[8px] text-white/25 uppercase">En Düşük Değer Etiketi</label><input value={field.min_label || ''} onChange={e => updateField(idx, { min_label: e.target.value })} placeholder="Hiç" className="w-full h-8 px-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/50" /></div>
                              <div className="space-y-1"><label className="text-[8px] text-white/25 uppercase">En Yüksek Değer Etiketi</label><input value={field.max_label || ''} onChange={e => updateField(idx, { max_label: e.target.value })} placeholder="Çok" className="w-full h-8 px-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/50" /></div>
                            </div>
                          )}

                          {field.type === 'rich_text' && (
                            <div className="space-y-1"><label className="text-[9px] font-bold text-white/30 uppercase">Zengin İçerik</label>
                              <RichTextEditor value={field.content || ''} onChange={html => updateField(idx, { content: html })} placeholder="Adaylara gösterilecek sabit HTML içerik..." minHeight="120px" /></div>
                          )}

                          {!['section_break', 'rich_text'].includes(field.type) && (
                            <div className="space-y-1"><label className="text-[9px] font-bold text-white/30 uppercase">Soru Açıklaması (İpucu)</label>
                              <RichTextEditor value={field.help_text || ''} onChange={html => updateField(idx, { help_text: html })} placeholder="Soru altında gösterilecek ipucu..." minHeight="60px" /></div>
                          )}

                          {field.type === 'section_break' && (
                            <div className="space-y-1"><label className="text-[9px] font-bold text-white/30 uppercase">Bölüm Açıklaması</label>
                              <textarea value={field.help_text || ''} onChange={e => updateField(idx, { help_text: e.target.value })} rows={2} className="w-full bg-white/5 border border-white/[0.06] focus:border-purple-500 rounded-xl px-2.5 py-2 text-xs text-white outline-none resize-none" /></div>
                          )}

                          {/* Footer Actions of Active Card */}
                          <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"><ChevronUp size={14}/></button>
                              <button type="button" onClick={() => moveField(idx, 'down')} disabled={idx === fields.length - 1} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"><ChevronDown size={14}/></button>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {!['section_break', 'rich_text'].includes(field.type) && (
                                <label className="flex items-center gap-1.5 cursor-pointer pr-3 border-r border-white/[0.08]">
                                  <span className="text-[10px] text-white/40 font-semibold">Gerekli</span>
                                  <button type="button" onClick={() => updateField(idx, { required: !field.required })}
                                    className={`relative w-8 h-4.5 rounded-full transition-colors ${field.required ? 'bg-purple-600' : 'bg-white/10'}`}>
                                    <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${field.required ? 'left-4' : 'left-0.5'}`} />
                                  </button>
                                </label>
                              )}

                              <button type="button" onClick={() => setAiModalOpen(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 text-[10px] font-bold text-purple-300 transition-all cursor-pointer" title="AI ile Soru Üret"><Bot size={11}/> AI ile Üret</button>
                              <button type="button" onClick={() => duplicateField(idx)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer" title="Kopyala"><Copy size={13}/></button>
                              <button type="button" onClick={() => removeField(idx)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/40 hover:text-rose-400 transition-colors cursor-pointer" title="Sil"><Trash2 size={13}/></button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Google Forms De-focused State (Summary view)
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FieldIcon type={field.type} />
                              <span className="text-xs font-bold text-white/80">{field.label}</span>
                              {field.required && <span className="text-rose-500 font-bold">*</span>}
                            </div>
                            {field.help_text && (
                              <p className="text-[10px] text-white/30 truncate max-w-lg" dangerouslySetInnerHTML={{ __html: field.help_text.replace(/<[^>]*>/g, '') }} />
                            )}
                          </div>
                          <span className="text-[8px] font-mono font-bold text-white/20 bg-white/5 border border-white/[0.03] px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {FIELD_TYPES.find(t => t.value === field.type)?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>


              {/* Right Floating vertical toolbar — add field types */}
              <div className="sticky top-24 flex flex-col gap-1.5 p-2 rounded-2xl shadow-2xl items-center"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', width: '56px' }}
              >
                {FIELD_TYPES.map(ft => {
                  const Icon = ft.icon;
                  const accent = config.accent_color || '#673AB7';
                  return (
                    <button
                      key={ft.value}
                      onClick={() => addField(ft.value)}
                      title={`${ft.label} Ekle`}
                      className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = accent + '30'; (e.currentTarget as HTMLButtonElement).style.borderColor = accent + '50'; (e.currentTarget as HTMLButtonElement).style.color = accent; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        )}


        {/* TABS 2: YANITLAR (RESPONSES) */}
        {activeTab === 'responses' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Responses Navigation Control Card */}
            <Card className="p-4 border-white/[0.06] bg-black/20 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{responsesCount} yanıt</span>
                  <span className="text-xs text-white/40">gerçek başvuru kaydı</span>
                </div>
                <div className="flex items-center gap-1.5 p-0.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                  <button onClick={() => setResponsesTab('summary')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${responsesTab === 'summary' ? 'bg-purple-600/25 text-purple-300 border border-purple-500/20' : 'text-white/40 hover:text-white'}`}>
                    Özet
                  </button>
                  <button onClick={() => setResponsesTab('question')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${responsesTab === 'question' ? 'bg-purple-600/25 text-purple-300 border border-purple-500/20' : 'text-white/40 hover:text-white'}`}>
                    Soru
                  </button>
                  <button onClick={() => setResponsesTab('individual')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${responsesTab === 'individual' ? 'bg-purple-600/25 text-purple-300 border border-purple-500/20' : 'text-white/40 hover:text-white'}`}>
                    Bağımsız
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold cursor-pointer transition-all">
                    CSV İndir
                  </button>
                  <button onClick={handleClearAllResponses} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 text-[10px] font-bold cursor-pointer transition-all">
                    Yanıtları Temizle
                  </button>
                  <a href="/applications" className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold border border-purple-500/30 transition-all">
                    <FileText size={11} /> Başvurular Paneline Git
                  </a>
                </div>

              </div>
            </Card>

            {responsesCount === 0 ? (
              <Card className="p-12 text-center border-dashed border-white/[0.06] bg-transparent rounded-2xl">
                <BarChart2 size={32} className="text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/20 font-semibold">Bu form için henüz herhangi bir yanıt gönderilmedi.</p>
              </Card>
            ) : (
              <>
                {/* SUBTAB 1: ÖZET (SUMMARY) */}
                {responsesTab === 'summary' && (
                  <div className="space-y-4">
                    {/* E-posta listesi kartı */}
                    <Card className="p-6 border-white/[0.06] bg-black/20 rounded-2xl space-y-3">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Kimler yanıt verdi?</h3>
                      <p className="text-[10px] text-white/40 uppercase font-mono tracking-wider">E-posta Adresleri ({rawResponses.length})</p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 hide-scrollbar">
                        {rawResponses.map((r, i) => (
                          <div key={i} className="px-3 py-2 rounded-xl bg-white/[0.01] border border-white/[0.03] text-xs text-white/80 font-mono flex items-center justify-between">
                            <span>{r.email || r.raw_answers?.email || 'E-posta belirtilmemiş'}</span>
                            <span className="text-[9px] text-white/30 font-sans">{r.full_name || r.raw_answers?.full_name || ''}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* Her soru için veri analitiği kartı */}
                    {fields.map((field) => {
                      if (field.type === 'section_break' || field.type === 'rich_text') return null;

                      // Toplanan tüm cevapları filtrele
                      const answersList = rawResponses.map(r => {
                        const ans = r.raw_answers?.[field.id] !== undefined ? r.raw_answers[field.id] : r.raw_answers?.[field.label];
                        return ans;
                      }).filter(val => val !== undefined && val !== null && val !== '');

                      // Grafik/Dağılım hesabı (Seçenekli sorularda)
                      const isOptionBased = ['select', 'radio', 'checkbox'].includes(field.type);
                      const stats: Record<string, number> = {};
                      if (isOptionBased) {
                        answersList.forEach(ans => {
                          if (Array.isArray(ans)) {
                            ans.forEach(val => { stats[val] = (stats[val] || 0) + 1; });
                          } else {
                            stats[String(ans)] = (stats[String(ans)] || 0) + 1;
                          }
                        });
                      }

                      return (
                        <Card key={field.id} className="p-6 border-white/[0.06] bg-black/20 rounded-2xl space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-white" dangerouslySetInnerHTML={{ __html: field.label }} />
                            <p className="text-[9px] text-purple-400 font-bold font-mono tracking-widest uppercase mt-1">{answersList.length} yanıt</p>
                          </div>

                          {isOptionBased ? (
                            // Seçenek oranları listesi
                            <div className="space-y-3">
                              {(field.options || []).map((opt) => {
                                const count = stats[opt] || 0;
                                const percent = answersList.length > 0 ? Math.round((count / answersList.length) * 100) : 0;
                                return (
                                  <div key={opt} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs font-semibold">
                                      <span className="text-white/80">{opt}</span>
                                      <span className="text-white/40">{count} yanıt (%{percent})</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                      <div className="h-full bg-purple-600 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            // Düz metin cevapları listesi
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 hide-scrollbar">
                              {answersList.slice(0, 10).map((ans, idx) => (
                                <div key={idx} className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
                                  {String(ans)}
                                </div>
                              ))}
                              {answersList.length > 10 && (
                                <p className="text-[10px] text-center text-white/20 font-bold">ve {answersList.length - 10} yanıt daha...</p>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* SUBTAB 2: SORU (QUESTION) */}
                {responsesTab === 'question' && (
                  <div className="space-y-4">
                    <Card className="p-4 border-white/[0.06] bg-black/20 rounded-2xl space-y-2">
                      <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest">İncelenecek Soru</label>
                      <select
                        value={selectedResponseQuestionId}
                        onChange={e => setSelectedResponseQuestionId(e.target.value)}
                        className="w-full h-10 bg-black/50 border border-white/[0.06] rounded-xl px-3 text-xs text-white outline-none cursor-pointer"
                      >
                        {fields.filter(f => f.type !== 'section_break' && f.type !== 'rich_text').map(f => (
                          <option key={f.id} value={f.id} className="bg-neutral-900">{f.label.replace(/<[^>]*>/g, '')}</option>
                        ))}
                      </select>
                    </Card>

                    {(() => {
                      const curF = fields.find(f => f.id === selectedResponseQuestionId);
                      if (!curF) return null;
                      
                      const answersList = rawResponses.map(r => ({
                        applicant: r.full_name || r.discord_tag || 'İsimsiz Aday',
                        answer: r.raw_answers?.[curF.id] !== undefined ? r.raw_answers[curF.id] : r.raw_answers?.[curF.label]
                      })).filter(item => item.answer !== undefined && item.answer !== null && item.answer !== '');

                      return (
                        <Card className="p-6 border-white/[0.06] bg-black/20 rounded-2xl space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-white">{curF.label}</h4>
                            <p className="text-[9px] text-purple-400 font-bold font-mono tracking-widest uppercase mt-1">{answersList.length} yanıt</p>
                          </div>
                          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 hide-scrollbar">
                            {answersList.map((item, idx) => (
                              <div key={idx} className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-1">
                                <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider">{item.applicant}</div>
                                <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{Array.isArray(item.answer) ? item.answer.join(', ') : String(item.answer)}</p>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })()}
                  </div>
                )}

                {/* SUBTAB 3: BAĞIMSIZ (INDIVIDUAL) */}
                {responsesTab === 'individual' && (
                  <div className="space-y-4">
                    {/* Bağımsız Navigasyon */}
                    <Card className="p-4 border-white/[0.06] bg-black/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          disabled={currentResponseIdx === 0}
                          onClick={() => setCurrentResponseIdx(p => p - 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-20 cursor-pointer text-[10px] font-bold"
                        >
                          Önceki
                        </button>
                        <span className="text-xs font-mono font-bold text-white">
                          {currentResponseIdx + 1} / {responsesCount}
                        </span>
                        <button
                          disabled={currentResponseIdx === responsesCount - 1}
                          onClick={() => setCurrentResponseIdx(p => p + 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-20 cursor-pointer text-[10px] font-bold"
                        >
                          Sonraki
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-purple-400 font-bold">
                        Gönderim Tarihi: {formatDate(rawResponses[currentResponseIdx]?.created_at)}
                      </span>
                    </Card>

                    {/* Doldurulmuş Form Detayı (Klon Arka Planı ve Şık Tasarımıyla) */}
                    {(() => {
                      const resp = rawResponses[currentResponseIdx];
                      if (!resp) return null;
                      const answersObj = resp.raw_answers || {};

                      return (
                        <div className="space-y-4">
                          <Card className="p-6 border-white/[0.06] bg-black/20 rounded-2xl space-y-2 border-l-8 border-purple-600">
                            <h3 className="text-base font-bold text-white">{resp.full_name || 'İsimsiz Aday'}</h3>
                            <p className="text-xs text-white/40 font-mono">E-posta: {resp.email || 'Belirtilmemiş'} • Discord: @{resp.discord_tag || 'Belirtilmemiş'} • Durum: <span className="text-purple-400 font-bold">{resp.status || 'Bekliyor'}</span></p>
                            
                            <div className="pt-3 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider mr-1">Karar:</span>
                                {['İnceleniyor', 'Başarılı', 'Başarısız', 'Spam', 'BlackList'].map(st => (
                                  <button
                                    key={st}
                                    onClick={() => handleUpdateIndividualResponseStatus(resp.applicant_id, st)}
                                    className={`h-6 px-3 rounded-lg text-[9px] font-bold cursor-pointer transition-all ${
                                      resp.status === st 
                                        ? 'bg-purple-600 text-white border border-purple-500/30' 
                                        : 'bg-white/[0.03] border border-white/[0.05] text-white/50 hover:text-white hover:bg-white/10'
                                    }`}
                                  >
                                    {st === 'İnceleniyor' ? 'Mülakata Al' : st}
                                  </button>
                                ))}
                              </div>

                              <button
                                onClick={() => handleDeleteIndividualResponse(resp.applicant_id)}
                                className="h-6 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-600 text-[9px] text-rose-400 hover:text-white font-bold cursor-pointer transition-all"
                              >
                                Adayı Sil
                              </button>
                            </div>
                          </Card>


                          {fields.map((field) => {
                            if (field.type === 'section_break') {
                              return (
                                <div key={field.id} className="pt-3 border-t border-white/[0.04] first:border-0">
                                  <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{field.label}</div>
                                  {field.help_text && <p className="text-[9px] text-white/30 mt-0.5">{field.help_text}</p>}
                                </div>
                              );
                            }
                            if (field.type === 'rich_text') {
                              return (
                                <div key={field.id} className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.02] text-white/50 text-[10px]"
                                  dangerouslySetInnerHTML={{ __html: field.content || '' }} />
                              );
                            }

                            const cleanLabel = field.label.replace(/<[^>]*>/g, '').trim().toLowerCase();
                            const matchedKey = Object.keys(answersObj).find(k => 
                              k.toLowerCase() === field.id.toLowerCase() ||
                              k.toLowerCase() === field.label.toLowerCase() ||
                              k.toLowerCase() === cleanLabel ||
                              cleanLabel.includes(k.toLowerCase()) ||
                              k.toLowerCase().includes(cleanLabel)
                            );
                            const val = matchedKey !== undefined ? answersObj[matchedKey] : undefined;
                            const displayVal = Array.isArray(val) ? val.join(', ') : String(val !== undefined && val !== null ? val : 'Cevaplanmamış');


                            return (
                              <Card key={field.id} className="p-5 border-white/[0.04] bg-black/20 rounded-2xl space-y-2">
                                <div className="text-xs font-bold text-white/70" dangerouslySetInnerHTML={{ __html: field.label }} />
                                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-white/90 leading-relaxed whitespace-pre-wrap">
                                  {displayVal}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TABS 3: AYARLAR (SETTINGS) */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Meta and Status */}
            <Card className="p-6 space-y-4 border-white/[0.06] bg-black/20 rounded-3xl">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400 border-b border-white/[0.04] pb-2">FORM GENEL AYARLARI</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">Form Gönderimi Aktif</span>
                      <span className="text-[9px] text-white/30 mt-0.5">Kapalıyken form yeni yanıtlara kapanır.</span>
                    </div>
                    <button type="button"
                      onClick={() => setConfig(c => ({ ...c, is_active: !c.is_active }))}
                      className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${config.is_active !== false ? 'bg-purple-600' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${config.is_active !== false ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                  
                  {selectedFormId === 'ysym_sinav' && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Sınavı Yetkililere Göster</span>
                        <span className="text-[9px] text-white/30 mt-0.5">Kapalıyken sıradan yetkililer sınav sekmesini göremez.</span>
                      </div>
                      <button type="button"
                        onClick={() => {
                          const nextVal = (config as any).is_exam_visible !== false ? false : true;
                          setConfig(c => ({ ...c, is_exam_visible: nextVal }));
                          localStorage.setItem('ysym-is-exam-visible', String(nextVal));
                        }}
                        className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${(config as any).is_exam_visible !== false ? 'bg-purple-600' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${(config as any).is_exam_visible !== false ? 'left-4' : 'left-0.5'}`} />
                      </button>

                    </div>
                  )}


                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Sınav / Başvuru Davet Kodu</label>
                    <input
                      value={config.invite_code || ''}
                      onChange={e => setConfig(c => ({ ...c, invite_code: e.target.value }))}
                      placeholder="Örn: YSYM-2026"
                      className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-purple-500/50"
                    />
                    <p className="text-[8px] text-white/20 mt-0.5">Sadece bu davet koduna sahip kullanıcılar formu görebilir.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Başarı Teşekkür Mesajı</label>
                    <textarea
                      value={config.success_message || ''}
                      onChange={e => setConfig(c => ({ ...c, success_message: e.target.value }))}
                      rows={4}
                      placeholder="Form başarıyla gönderildikten sonra görüntülenecek başarı mesajı..."
                      className="w-full bg-white/5 border border-white/[0.06] focus:border-purple-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Banner & Colors settings */}
            <Card className="p-6 space-y-4 border-white/[0.06] bg-black/20 rounded-3xl">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400 border-b border-white/[0.04] pb-2">TEMA & TAMPON AYARLARI</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <UploadZone label="Form Kapak Görseli" currentUrl={config.banner_url || ''} onUpload={url => setConfig(c => ({ ...c, banner_url: url }))} />

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Vurgu Rengi</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCENT_PRESETS.map(c => <ColorDot key={c} color={c} active={config.accent_color === c} onClick={() => setConfig(x => ({ ...x, accent_color: c }))} />)}
                      <input type="color" value={config.accent_color || '#673AB7'} onChange={e => setConfig(x => ({ ...x, accent_color: e.target.value }))} className="w-6 h-6 rounded-lg border border-white/10 bg-transparent cursor-pointer" title="Özel renk" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Arka Plan Rengi</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BG_PRESETS.map(c => <ColorDot key={c} color={c} active={config.bg_color === c} onClick={() => setConfig(x => ({ ...x, bg_color: c }))} />)}
                      <input type="color" value={config.bg_color || '#0f0d13'} onChange={e => setConfig(x => ({ ...x, bg_color: e.target.value }))} className="w-6 h-6 rounded-lg border border-white/10 bg-transparent cursor-pointer" title="Özel renk" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Intro layout */}
            <Card className="p-6 space-y-2 border-white/[0.06] bg-black/20 rounded-3xl">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400 border-b border-white/[0.04] pb-2">BAŞLANGIÇ GİRİŞ METNİ</h3>
              <RichTextEditor value={config.intro_html || ''} onChange={html => setConfig(c => ({ ...c, intro_html: html }))} placeholder="Formun girişinde gösterilecek zengin metin açıklaması..." minHeight="120px" />
            </Card>
          </div>
        )}
      </div>

      {/* AI QUESTION GENERATOR MODAL */}
      <AnimatePresence>
        {aiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#0e0c12] border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl relative"
            >
              <button onClick={() => setAiModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer"><X size={14} /></button>
              
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Yapay Zeka ile Soru Üret</h3>
                  <p className="text-[10px] text-white/40">Groq LLaMA ile otomatik form / sınav oluştur</p>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="flex gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setAiMode('quick')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    aiMode === 'quick' ? 'bg-purple-600 text-white shadow-sm' : 'text-white/50 hover:text-white'
                  }`}
                >
                  ⚡ Hızlı Soru Ekle
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('full')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    aiMode === 'full' ? 'bg-purple-600 text-white shadow-sm' : 'text-white/50 hover:text-white'
                  }`}
                >
                  🎓 Tam Sınav Oluştur
                </button>
              </div>

              {aiMode === 'quick' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Ne tür sorular üretmek istersiniz?</label>
                    <textarea
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder="Örn: Discord moderasyonu hakkında 5 çoktan seçmeli soru..."
                      rows={4}
                      className="w-full bg-white/5 border border-white/[0.06] focus:border-purple-500 rounded-2xl p-3.5 text-xs text-white outline-none resize-none font-medium leading-relaxed"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <button type="button" onClick={() => setAiModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 cursor-pointer transition-all">İptal</button>
                    <button
                      type="button"
                      onClick={() => handleGenerateQuestionsWithAI()}
                      disabled={aiGenerating || !aiPrompt.trim()}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50 active:scale-95"
                    >
                      {aiGenerating ? (
                        <><span className="animate-spin">⏳</span> Üretiliyor...</>
                      ) : (
                        <>✨ Soruları Üret ve Ekle</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-[10px] text-purple-300 leading-relaxed">
                    🎓 <strong>Tam Sınav Modu:</strong> Belirttiğiniz konulara ve bölüm sayısına göre yapılandırılmış, bölüm başlıkları ve sorulardan oluşan eksiksiz bir sınav formu oluşturur.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-white/30 uppercase">Sınav Konuları / Açıklama</label>
                    <textarea
                      value={aiExamTopics}
                      onChange={e => setAiExamTopics(e.target.value)}
                      placeholder="Örn: Lutheus Discord sunucusu için YSYM yetkili alım sınavı. Konular: moderasyon kuralları, topluluk yönetimi, çatışma çözümü, Minecraft bilgisi..."
                      rows={4}
                      className="w-full bg-white/5 border border-white/[0.06] focus:border-purple-500 rounded-2xl p-3.5 text-xs text-white outline-none resize-none font-medium leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-white/30 uppercase">Bölüm Sayısı</label>
                      <select
                        value={aiExamSections}
                        onChange={e => setAiExamSections(e.target.value)}
                        className="w-full h-9 bg-white/5 border border-white/[0.06] rounded-xl px-3 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                      >
                        {['1','2','3','4','5'].map(n => <option key={n} value={n} className="bg-[#0e0c12]">{n} bölüm</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-white/30 uppercase">Bölüm Başına Soru</label>
                      <select
                        value={aiExamQPerSection}
                        onChange={e => setAiExamQPerSection(e.target.value)}
                        className="w-full h-9 bg-white/5 border border-white/[0.06] rounded-xl px-3 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                      >
                        {['2','3','4','5','6','8'].map(n => <option key={n} value={n} className="bg-[#0e0c12]">{n} soru</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5">
                    <button type="button" onClick={() => setAiModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 cursor-pointer transition-all">İptal</button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!aiExamTopics.trim()) { return; }
                        const fullPrompt = `${parseInt(aiExamSections)} bölümlü ve her bölümde ${parseInt(aiExamQPerSection)} soru olan tam bir sınav oluştur. Sınav konuları: ${aiExamTopics}. Her bölüm için section_break tipinde bir ayırıcı ekle, ardından o bölüme ait sorular gelsin. Sorular arasında text, textarea, radio ve checkbox tipleri kullan. Çoktan seçmeli sorular için options ekle.`;
                        handleGenerateQuestionsWithAI(fullPrompt);
                      }}
                      disabled={aiGenerating || !aiExamTopics.trim()}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-purple-600/20"
                    >
                      {aiGenerating ? (
                        <><span className="animate-spin">⏳</span> Sınav Oluşturuluyor...</>
                      ) : (
                        <>🎓 Tam Sınavı Oluştur</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORM DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#0e0c12] border border-rose-500/20 rounded-3xl p-6 space-y-4 shadow-2xl relative"
            >
              <button onClick={() => setDeleteConfirmOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer"><X size={14} /></button>
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Formu Silmek İstiyor musunuz?</h3>
                  <p className="text-[10px] text-white/40">Bu işlem formu veritabanından tamamen yok edecektir.</p>
                </div>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                Bu formu ve formu dolduran adayların tüm yanıt geçmişini tamamen silmek üzeresiniz. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 cursor-pointer transition-all">İptal</button>
                <button
                  type="button"
                  onClick={handleFormDelete}
                  disabled={saving}
                  className="px-4.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                >
                  {saving ? 'Siliniyor...' : 'Evet, Formu Kalıcı Olarak Sil'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

