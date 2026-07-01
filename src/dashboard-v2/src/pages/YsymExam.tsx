import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabaseFetch } from '../lib/supabase';
import { Bot, Send, CheckCircle, Info, GraduationCap, ChevronRight, ChevronLeft, Star, LogOut, Upload } from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'rating' | 'scale' | 'date' | 'time' | 'file' | 'section_break' | 'rich_text';
  required: boolean;
  options?: string[];
  placeholder?: string;
  help_text?: string;
  min_value?: number;
  max_value?: number;
  min_label?: string;
  max_label?: string;
  allow_multiple?: boolean;
  max_files?: number;
  content?: string;
}

interface CustomForm {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  config?: {
    banner_url?: string;
    success_message?: string;
    bg_color?: string;
    accent_color?: string;
    intro_html?: string;
    invite_code?: string;
    is_active?: boolean;
  };
}


export default function YsymExam() {
  const { session, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [appId, setAppId] = useState('');

  
  // Multi-section state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForm() {
      // Role check
      const userRole = session?.role?.toLowerCase() || '';
      const isCandidate = ['pending', 'eski_yetkili'].includes(userRole);
      if (isCandidate) {
        navigate('/apply');
        return;
      }

      // Exam visibility check — non-management staff cannot access when exam is hidden
      const isMgmtRole = ['kurucu', 'admin', 'yonetici', 'yönetici', 'genel_sorumlu', 'discord_yoneticisi', 'discord_yöneticisi', 'kidemli', 'kıdemli', 'kidemli_discord_moderatoru', 'kidemli_discord_moderatörü', 'senior_moderator'].includes(userRole);
      const isExamVisible = localStorage.getItem('ysym-is-exam-visible') !== 'false';
      if (!isMgmtRole && !isExamVisible) {
        navigate('/');
        return;
      }

      try {
        const data = await supabaseFetch<CustomForm[]>('custom_forms', 'GET', 'id=eq.ysym_sinav');
        if (data && data[0]) {
          const configObj = data[0];
          setFormConfig(configObj);
          
          // Invite code check
          const queryParams = new URLSearchParams(location.search);
          const enteredCode = queryParams.get('code');
          const correctCode = configObj.config?.invite_code;

          if (correctCode && enteredCode !== correctCode) {
            setInviteError(
              correctCode 
                ? 'Lütfen geçerli bir sınav davet bağlantısı veya kodu kullanın.' 
                : null
            );
          }

          // Initialize answers
          const initialAnswers: Record<string, any> = {};
          configObj.fields.forEach(f => {
            if (f.type !== 'section_break') {
              initialAnswers[f.id] = '';
            }
          });
          setAnswers(initialAnswers);
        }

        const isMgmt = ['kurucu', 'admin', 'yonetici', 'yönetici', 'genel_sorumlu', 'discord_yoneticisi', 'discord_yöneticisi', 'kidemli', 'kıdemli', 'kidemli_discord_moderatoru', 'kidemli_discord_moderatörü', 'senior_moderator'].includes(userRole);

        
        if (session?.profile?.username && !isMgmt) {
          const submissions = await supabaseFetch<any[]>('ysym_submissions', 'GET', `discord_tag=eq.${session.profile.username}`);
          if (submissions && submissions.length > 0) {
            setAlreadyApplied(true);
            setAppId(submissions[0].applicant_id);
          }
        }

      } catch (err: any) {
        showToast('Form yüklenirken hata oluştu.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadForm();
  }, [session, location.search]);


  // Group fields into sections
  const sections = useMemo(() => {
    if (!formConfig) return [];
    const result: { title: string; description: string; fields: FormField[] }[] = [];
    let currentSection = { title: formConfig.title, description: formConfig.description, fields: [] as FormField[] };

    formConfig.fields.forEach(field => {
      if (field.type === 'section_break') {
        if (currentSection.fields.length > 0 || result.length > 0) {
          result.push(currentSection);
        }
        currentSection = {
          title: field.label,
          description: field.help_text || '',
          fields: []
        };
      } else {
        currentSection.fields.push(field);
      }
    });
    result.push(currentSection);
    return result;
  }, [formConfig]);

  const handleInputChange = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleNextSection = () => {
    const currentFields = sections[currentSectionIndex]?.fields || [];
    for (const field of currentFields) {
      if (field.required && !answers[field.id]?.toString().trim()) {
        showToast(`Lütfen "${field.label}" alanını doldurun.`, 'error');
        return;
      }
    }
    setCurrentSectionIndex(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevSection = () => {
    setCurrentSectionIndex(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!formConfig) return;
    for (const field of formConfig.fields) {
      if (field.type !== 'section_break' && field.required && !answers[field.id]?.toString().trim()) {
        showToast(`Lütfen "${field.label}" alanını doldurun.`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const allSubmissions = await supabaseFetch<any[]>('ysym_submissions', 'GET', 'select=applicant_id');
      const count = allSubmissions ? allSubmissions.length : 0;
      const year = new Date().getFullYear();
      const generatedId = `YSY-${year}-${String(count + 1).padStart(4, '0')}`;

      // Automatically pull staff info from session profile
      answers['discord_user_id'] = session?.profile?.discordId || session?.uid || 'Belirtilmemiş';

      answers['discord_username'] = session?.profile?.username || 'Belirtilmemiş';
      answers['user_email'] = session?.profile?.email || 'Belirtilmemiş';

      const newRecord = {
        applicant_id: generatedId,
        status: 'Beklemede',
        form_type: 'ysym_exam',
        full_name: session?.profile?.displayName || session?.profile?.username || 'Bilinmeyen Yetkili',
        discord_tag: session?.profile?.username || 'Bilinmeyen Discord',
        email: session?.profile?.email || 'e-posta@lutheus.app',
        raw_answers: { ...answers },
        created_at: new Date().toISOString()
      };


      await supabaseFetch('ysym_submissions', 'POST', '', newRecord);

      // Trigger Discord notification via Apps Script
      const scriptUrl = localStorage.getItem('lutheus-google-script-url');
      if (scriptUrl) {
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'newSubmission',
            applicantId: generatedId,
            status: 'YSYM Sınav Başvurusu',
            email: session?.profile?.email || '',
            fullName: session?.profile?.displayName || session?.profile?.username || '',
            discordInfo: session?.profile?.username || '',
            formType: 'ysym',
            answers: formConfig?.fields.filter(f => f.type !== 'section_break').map(f => answers[f.id] || '')
          })
        }).catch(err => console.warn('YSYM Discord notification failed:', err));
      }

      showToast('Sınav yanıtlarınız başarıyla gönderildi!', 'success');
      setAlreadyApplied(true);
      setAppId(generatedId);
    } catch (err: any) {
      showToast('Sınav gönderilirken hata oluştu: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0EBF8] text-gray-800 space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-gray-500">Yükleniyor...</span>
      </div>
    );
  }

  const successMessage = formConfig?.config?.success_message || 'YSYM yetkili yeterlilik sınavı yanıtlarınız sisteme kaydedilmiştir. Yönetim ekibi yanıtlarınızı ve AI değerlendirme puanınızı en kısa sürede kontrol edecektir.';
  const customBannerUrl = formConfig?.config?.banner_url || 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=2070&auto=format&fit=crop';

  const userRole = session?.role?.toLowerCase() || '';
  const isMgmt = ['kurucu', 'admin', 'yonetici', 'yönetici', 'genel_sorumlu', 'discord_yoneticisi', 'discord_yöneticisi', 'kidemli', 'kıdemli', 'kidemli_discord_moderatoru', 'kidemli_discord_moderatörü', 'senior_moderator'].includes(userRole);

  if (inviteError && !isMgmt) {
    return (
      <div className="min-h-screen bg-[#F0EBF8] py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full space-y-6">
          <Card className="p-8 text-center bg-white border border-gray-200 shadow-sm rounded-3xl space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100">
              <Info className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Erişim Engellendi</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{inviteError}</p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/apply')}
                className="w-full flex items-center justify-center h-10 px-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors shadow-sm cursor-pointer"
              >
                Başvuru Sayfasına Git
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }


  if ((formConfig?.config as any)?.is_active === false && !isMgmt) {

    return (
      <div className="min-h-screen bg-[#F0EBF8] py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full space-y-6">
          <Card className="p-8 text-center bg-white border border-gray-200 shadow-sm rounded-3xl space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
              <Info className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Sınav Kapalı</h2>
              <p className="text-sm text-gray-500 leading-relaxed">YSYM Yetkililik Sınavı şu an yeni sınav katılımlarına kapatılmıştır. Lütfen yönetim ile iletişime geçin.</p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/apply')}
                className="w-full flex items-center justify-center h-10 px-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors shadow-sm cursor-pointer"
              >
                Başvuru Sayfasına Git
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (alreadyApplied && !isMgmt) {


    return (
      <div className="min-h-screen bg-[#F0EBF8] py-12 px-4 flex items-center justify-center">
        <div className="max-w-xl w-full space-y-6">
          <Card className="p-8 text-center bg-white border border-gray-200 shadow-sm rounded-3xl space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Sınav Tamamlandı!</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{successMessage}</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl w-fit mx-auto text-xs font-mono font-bold text-gray-600">
              Sınav Takip No: <span className="text-indigo-600 font-bold">{appId}</span>
            </div>
            <div className="pt-2">
              <button
                onClick={() => logout()}
                className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 mx-auto cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Hesaptan Çıkış Yap
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currentSection = sections[currentSectionIndex];

  const isExamVisible = localStorage.getItem('ysym-is-exam-visible') !== 'false';

  const isFormActive = (formConfig?.config as any)?.is_active !== false;


  // Render Sınav Kapalı screen if hidden and user is not management
  if ((!isExamVisible || !isFormActive) && !isMgmt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0EBF8' }}>
        <div className="max-w-md w-full space-y-6">
          <Card className="p-8 text-center bg-white border border-gray-200 shadow-sm rounded-3xl space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">YSYM Sınavı Şu Anda Kapalı!</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Yeterlilik Sınavı Formu şu anda yeni katılımlara kapalıdır. Sınav dönemleri yönetim tarafından açıldığında bu alandan sınava giriş yapabilirsiniz.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button onClick={() => logout()} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"><LogOut className="w-3.5 h-3.5" /> Hesaptan Çıkış Yap</button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const customBgColor = (formConfig?.config as any)?.bg_color || '#F0EBF8';
  const accentColor = (formConfig?.config as any)?.accent_color || '#8B5CF6';
  const isExtensionCtx = typeof chrome !== 'undefined' && !!chrome?.runtime?.getURL;
  const _assetBase = (() => {
    if (isExtensionCtx) return '';
    if (window.location.protocol === 'file:') return './';
    if (window.location.pathname.startsWith('/dashboard')) return '/dashboard/';
    return './';
  })();
  const logoSrc = isExtensionCtx ? 'icon128.png' : `${_assetBase}icon128.png`;

  return (
    <div className="min-h-screen pb-16 transition-all duration-300" style={{ backgroundColor: customBgColor, fontFamily: "'Google Sans', 'Roboto', sans-serif", color: '#202124' }}>

      {/* Nuclear CSS Reset — kill ALL inherited dark/blue from extension global styles */}
      <style>{`
        .lf-public-form * {
          box-sizing: border-box;
        }
        .lf-public-form a { color: inherit !important; text-decoration: none !important; }
        .lf-public-form span, .lf-public-form label, .lf-public-form p, .lf-public-form div {
          color: inherit;
        }
        .lf-public-form input, .lf-public-form textarea, .lf-public-form select {
          color: #202124 !important;
          color-scheme: light;
          background-color: #fff !important;
        }
        .lf-public-form select option { background-color: #fff !important; color: #202124 !important; }
        .lf-option-label { color: #202124 !important; font-weight: 400; }
        .lf-question-card { background: #fff !important; }
      `}</style>

      <div className="ysym-form-root lf-public-form" style={{ color: '#202124' }}>
      
      {/* Top Decorator Bar */}
      <div className="h-2.5 w-full" style={{ backgroundColor: accentColor }} />

      {/* Lutheus Logo Header */}
      <div className="max-w-2xl mx-auto px-5 pt-5 flex items-center gap-2.5 select-none">
        <img
          src={logoSrc}
          alt="Lutheus"
          className="w-7 h-7 object-contain rounded-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span style={{ color: '#202124', fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Lutheus</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-3 space-y-6 relative">

        


        {/* Banner Image Card */}
        <div className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm max-h-48">
          <img src={customBannerUrl} alt="YSYM Exam Banner" className="w-full h-full object-cover" />
        </div>

        {/* Section indicator badge */}
        <div className="w-fit bg-purple-700 text-white text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider">
          Bölüm {currentSectionIndex + 1} / {sections.length}
        </div>

        {/* Header Title Card with purple left border */}
        <div className="bg-white border border-gray-200 border-l-8 rounded-xl shadow-sm p-6 space-y-4" style={{ borderLeftColor: accentColor }}>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">{currentSectionIndex === 0 ? formConfig?.title : currentSection?.title}</h1>
            
            {/* Display intro_html if set and on page 1 */}
            {currentSectionIndex === 0 && formConfig?.config?.intro_html ? (
              <div 
                className="text-xs text-gray-600 leading-relaxed mt-3 pt-3 border-t border-gray-100 prose prose-sm max-w-none" 
                dangerouslySetInnerHTML={{ __html: formConfig.config.intro_html }} 
              />
            ) : (
              (currentSectionIndex === 0 ? formConfig?.description : currentSection?.description) && (
                <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap mt-2">
                  {currentSectionIndex === 0 ? formConfig?.description : currentSection?.description}
                </p>
              )
            )}
          </div>
          
          <div className="pt-3 border-t border-gray-100 space-y-2.5">
            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Giriş Yapılan Discord Hesabı: <strong>@{session?.profile?.username}</strong></span>
              <button onClick={() => logout()} className="text-red-500 hover:text-red-600 flex items-center gap-0.5 font-bold cursor-pointer ml-auto">
                <LogOut className="w-3 h-3" /> Çıkış
              </button>
            </div>
            
            <div className="text-[11px] text-purple-700 bg-purple-50 px-3 py-2 rounded-xl border border-purple-100 flex items-center justify-between">
              <span>Bu form, tüm katılımcılardan otomatik olarak e-posta adresi topluyor.</span>
              <button 
                type="button"
                onClick={() => {
                  const role = session?.role?.toLowerCase() || '';
                  const isCandidate = ['pending', 'eski_yetkili'].includes(role);
                  if (!isCandidate) {
                    navigate('/manage-forms');
                  } else {
                    showToast('Bu ayarları değiştirme yetkiniz bulunmamaktadır.', 'error');
                  }
                }}
                className="font-bold cursor-pointer hover:underline text-[10px] bg-transparent border-0 text-purple-700 outline-none"
              >
                Ayarları değiştir
              </button>
            </div>

          </div>
        </div>

        {/* Dynamic Fields of Current Section */}
        <div className="space-y-4">
          {currentSection?.fields.map((field) => (
            <div
              key={field.id}
              className="lf-question-card"
              style={{
                background: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.07)',
              }}
            >
              {field.type !== 'rich_text' && (
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-900">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.help_text && (field.type as string) !== 'rich_text' && (
                    <div className="text-[11px] text-gray-400 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: field.help_text }} />
                  )}

                </div>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  placeholder={field.placeholder || 'Yanıtınız...'}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  rows={4}
                  className="w-full bg-gray-50/50 border border-gray-200 focus:border-purple-500 focus:bg-white rounded-xl px-4 py-3 text-xs text-gray-800 outline-none transition-colors resize-none font-medium leading-relaxed"
                />
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-full h-11 bg-gray-50/50 border border-gray-200 focus:border-purple-500 focus:bg-white rounded-xl px-3 text-xs text-gray-800 outline-none transition-colors font-semibold"
                >
                  <option value="">Seçiniz</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'radio' ? (
                <div className="space-y-1 pt-1">
                  {field.options?.map((opt) => (
                    <label
                      key={opt}
                      onClick={() => handleInputChange(field.id, opt)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: answers[field.id] === opt ? `${accentColor}12` : 'transparent',
                        border: `1px solid ${answers[field.id] === opt ? accentColor + '40' : 'transparent'}`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${answers[field.id] === opt ? accentColor : '#9aa0a6'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#fff', transition: 'border-color 0.15s',
                      }}>
                        {answers[field.id] === opt && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor }} />
                        )}
                      </div>
                      <span className="lf-option-label" style={{ fontSize: '14px', color: '#202124', fontWeight: 400 }}>{opt}</span>
                      <input type="radio" className="sr-only" value={opt} checked={answers[field.id] === opt} readOnly />
                    </label>
                  ))}
                </div>
              ) : field.type === 'checkbox' ? (
                <div className="space-y-1 pt-1">
                  {field.options?.map((opt) => {
                    const selected: string[] = answers[field.id] || [];
                    const isChecked = selected.includes(opt);
                    const handleToggle = () => {
                      const next = isChecked ? selected.filter(s => s !== opt) : [...selected, opt];
                      handleInputChange(field.id, next);
                    };
                    return (
                      <label
                        key={opt}
                        onClick={handleToggle}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isChecked ? `${accentColor}12` : 'transparent',
                          border: `1px solid ${isChecked ? accentColor + '40' : 'transparent'}`,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                          border: `2px solid ${isChecked ? accentColor : '#9aa0a6'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isChecked ? accentColor : '#fff', transition: 'all 0.15s',
                        }}>
                          {isChecked && <svg style={{ width: '10px', height: '10px', color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="lf-option-label" style={{ fontSize: '14px', color: '#202124', fontWeight: 400 }}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : field.type === 'scale' ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{field.min_label || String(field.min_value ?? 1)}</span>
                    <span className="text-xs text-gray-500">{field.max_label || String(field.max_value ?? 10)}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({length: (field.max_value ?? 10) - (field.min_value ?? 1) + 1}, (_, i) => i + (field.min_value ?? 1)).map(n => (
                      <button
                        key={n} type="button"
                        onClick={() => handleInputChange(field.id, n)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                          answers[field.id] === n
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-gray-200'
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              ) : (field.type === 'date' || field.label.toLowerCase().includes('doğum tarihi') || field.label.toLowerCase().includes('dogum tarihi')) ? (
                <input
                  type="date"
                  required={field.required}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-full h-11 bg-gray-50/50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 text-xs text-gray-800 outline-none transition-colors font-semibold"
                  style={{ colorScheme: 'light' }}
                />
              ) : field.type === 'time' ? (
                <input
                  type="time"
                  required={field.required}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-full h-11 bg-gray-50/50 border border-gray-200 focus:border-purple-500 focus:bg-white rounded-xl px-4 text-xs text-gray-800 outline-none transition-colors font-semibold"
                  style={{ colorScheme: 'light' }}
                />
              ) : field.type === 'file' ? (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center w-full h-28 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-purple-50/30 hover:border-purple-300 transition-all group">
                    <Upload className="w-6 h-6 text-gray-400 group-hover:text-purple-400 mb-1.5 transition-colors" />
                    <span className="text-xs font-semibold text-gray-500 group-hover:text-purple-500">Dosya Seçin veya Sürükleyin</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, PDF, max 5MB</span>
                    <input
                      type="file"
                      className="sr-only"
                      multiple={field.allow_multiple}
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleInputChange(field.id, Array.from(files).map(f => f.name).join(', '));
                        }
                      }}
                    />
                  </label>
                  {answers[field.id] && (
                    <p className="text-xs text-purple-600 font-semibold px-1">✔ {answers[field.id]}</p>
                  )}
                </div>
              ) : field.type === 'rich_text' ? (
                <div
                  className="prose prose-sm max-w-none text-gray-700 text-xs leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: field.content || field.help_text || '' }}
                />
              ) : field.type === 'rating' ? (
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((starValue) => (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => handleInputChange(field.id, starValue)}
                      className="p-1 cursor-pointer transition-transform active:scale-95"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          starValue <= (answers[field.id] || 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  ))}
                  {answers[field.id] && (
                    <span className="text-xs font-bold text-amber-500 ml-1.5">({answers[field.id]} / 5)</span>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder || 'Yanıtınız...'}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-full h-11 bg-gray-50/50 border border-gray-200 focus:border-purple-500 focus:bg-white rounded-xl px-4 text-xs text-gray-800 outline-none transition-colors font-semibold"
                />
              )}
            </div>
          ))}
        </div>

        {/* Section Navigation Actions */}
        <div className="flex items-center justify-between pt-2">
          {currentSectionIndex > 0 ? (
            <button
              type="button"
              onClick={handlePrevSection}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" /> Geri
            </button>
          ) : <div />}

          {currentSectionIndex < sections.length - 1 ? (
            <button
              type="button"
              onClick={handleNextSection}
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 animate-in fade-in"
            >
              İleri <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Gönderiliyor...' : 'Sınavı Bitir ve Gönder'}
            </button>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}
