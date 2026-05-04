import React, { useState } from 'react';
import { CATEGORIES, RULES, Rule, RuleCategory, PunishmentStep } from '../config/punishments';

// --- Placeholder UI Components (Assuming Shadcn UI or similar) ---
const Card = ({ children, className }: any) => <div className={`bg-[#171717] border border-neutral-800 rounded-xl overflow-hidden ${className}`}>{children}</div>;
const Button = ({ children, variant, className, ...props }: any) => {
  const base = "px-4 py-2 rounded-md font-medium transition-colors";
  const variants: any = {
    ghost: "hover:bg-neutral-800/50 text-neutral-300",
    outline: "border border-neutral-700 text-neutral-300 hover:bg-neutral-800",
    secondary: "bg-neutral-800 text-white hover:bg-neutral-700 border border-dashed border-neutral-600",
    destructive: "bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900/80 hover:text-red-200",
    default: "bg-violet-600 text-white hover:bg-violet-700 hover:shadow-[0_0_15px_rgba(124,58,237,0.5)]"
  };
  return <button className={`${base} ${variants[variant || 'default']} ${className}`} {...props}>{children}</button>;
};
const Input = ({ className, ...props }: any) => <input className={`bg-neutral-900 border-b border-neutral-800 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-md ${className}`} {...props} />;
const Select = ({ children, className, ...props }: any) => <select className={`bg-neutral-900 border border-neutral-800 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`} {...props}>{children}</select>;
const Textarea = ({ className, ...props }: any) => <textarea className={`bg-neutral-900 border border-neutral-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-full min-h-[100px] ${className}`} {...props} />;

export default function CukRuleEditor() {
  const [activeCategory, setActiveCategory] = useState<string>('A1');
  
  // Transform rules into a list for the sidebar
  const ruleList = Object.values(RULES);
  const activeRuleData = RULES[activeCategory];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 p-8 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Kural Eğitimi (CUK Rule Editor)</h1>
          <p className="text-neutral-500 text-sm mt-1">İhlal kategorilerini, tekrar kurallarını ve anahtar kelimeleri yönetin.</p>
        </div>
        <Button variant="ghost">Geri Dön</Button>
      </div>

      <div className="flex flex-1 gap-6 h-[calc(100vh-140px)]">
        {/* Left Panel: Category List */}
        <Card className="w-80 flex flex-col">
          <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
            <span className="font-semibold text-white">Kategoriler</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {ruleList.map((rule: Rule) => {
              const isActive = activeCategory === rule.id;
              return (
                <button
                  key={rule.id}
                  onClick={() => setActiveCategory(rule.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center gap-3 ${
                    isActive 
                      ? 'bg-violet-500/10 text-violet-300 border-l-2 border-violet-500 font-medium' 
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-300 border-l-2 border-transparent'
                  }`}
                >
                  <span className="truncate">{rule.name}</span>
                </button>
              );
            })}
          </div>
          <div className="p-4 border-t border-neutral-800">
            <Button variant="outline" className="w-full flex justify-center items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Yeni Kategori Ekle
            </Button>
          </div>
        </Card>

        {/* Right Panel: Editor Form */}
        <Card className="flex-1 flex flex-col">
          {activeRuleData ? (
            <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
              
              <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Kural İsmi</label>
                  <Input 
                    type="text" 
                    defaultValue={activeRuleData.name} 
                    className="w-full text-lg font-medium bg-transparent border-0 border-b-2 border-neutral-800 rounded-none px-0 py-2 focus:ring-0 focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 block">Tekrar Kuralları (Kademeli Ceza)</label>
                <div className="space-y-3">
                  {activeRuleData.steps.map((step: PunishmentStep, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
                      <span className="text-sm font-medium text-neutral-400 w-20">{idx + 1}. Tekrar</span>
                      
                      <Select className="w-32 h-10" defaultValue={activeRuleData.type}>
                        <option value="MUTE">Mute</option>
                        <option value="BAN">Ban</option>
                        <option value="RESTRICTION">Kısıtlama</option>
                      </Select>
                      
                      <Input 
                        type="number" 
                        defaultValue={step.duration} 
                        className="w-24 h-10 text-center" 
                        min="0"
                      />
                      
                      <Select className="w-32 h-10" defaultValue={step.unit}>
                        <option value="MINUTES">Dakika</option>
                        <option value="HOURS">Saat</option>
                        <option value="DAYS">Gün</option>
                        <option value="UNLIMITED">Sınırsız</option>
                      </Select>
                    </div>
                  ))}
                  
                  <Button variant="secondary" className="w-full mt-4 flex justify-center items-center gap-2 h-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Yeni Tekrar Kademesi Ekle
                  </Button>
                </div>
              </div>

              <div className="mb-8 flex-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Anahtar Kelimeler (Yapay Zeka Tespiti İçin)</label>
                <Textarea 
                  placeholder="Virgülle ayırarak anahtar kelimeleri girin (örn: küfür, hakaret, saygısızlık...)" 
                  defaultValue="küfür, hakaret"
                />
                <p className="text-xs text-neutral-500 mt-2">Bu kelimeler, yapay zekanın ihlali otomatik tespit etmesinde kullanılacaktır.</p>
              </div>

              <div className="mt-auto pt-6 border-t border-neutral-800 flex justify-between items-center">
                <Button variant="destructive">Kategoriyi Sil</Button>
                <Button variant="default">Kaydet ve Uygula</Button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-500">
              Düzenlemek için sol taraftan bir kategori seçin.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
