import { useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Trash2, Plus, Save, Upload, X, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';

interface Category {
  id: string;
  name: string;
  keywords: string[];
  invalidKeywords: string[];
  color: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Küfür/Hakaret', keywords: ['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik'], invalidKeywords: ['hatalı ceza', 'iptal edildi'], color: '#ef4444' },
  { id: '2', name: 'Yetkililere Saygısızlık', keywords: ['yetkili', 'admin', 'mod', 'ekip', 'aşağılama', 'iftira'], invalidKeywords: [], color: '#f97316' },
  { id: '3', name: 'Sunucu Dinamiği', keywords: ['sunucu dinamiği', 'flood', 'spam', 'polemik', 'ekran'], invalidKeywords: [], color: '#a855f7' },
  { id: '4', name: 'Reklam', keywords: ['reklam', 'davet linki', 'discord.gg', 'youtube.com'], invalidKeywords: [], color: '#3b82f6' },
  { id: '5', name: 'Discord ToS', keywords: ['tos', 'discord terms', 'kural dışı', '13 yaş', 'terör'], invalidKeywords: [], color: '#22c55e' },
  { id: '6', name: 'Dini/Milli Değerler', keywords: ['dini değer', 'milli değer', 'atatürk', 'din', 'kutsala'], invalidKeywords: [], color: '#eab308' },
  { id: '7', name: 'Destek Talebi', keywords: ['destek', 'bilet', 'ticket', 'tekrarlı', 'troll'], invalidKeywords: [], color: '#06b6d4' },
];

function TagInput({ tags, onAdd, onRemove, placeholder, disabled }: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [val, setVal] = useState('');
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && val.trim()) {
      e.preventDefault();
      onAdd(val.trim().toLowerCase());
      setVal('');
    }
  };
  return (
    <div className="min-h-[52px] bg-background border border-border/50 rounded-xl p-2.5 flex flex-wrap gap-1.5 focus-within:ring-1 ring-primary/50">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
          {t}
          {!disabled && (
            <button onClick={() => onRemove(t)} className="hover:text-primary/60 transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="bg-transparent text-sm min-w-[150px] flex-1 outline-none text-foreground placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

export default function Rules() {
  const { session } = useAuth();
  const canEdit = hasPermission(session?.role || '', 'penalty_accuracy:update');

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeId, setActiveId] = useState(DEFAULT_CATEGORIES[0].id);
  const [saved, setSaved] = useState(false);

  const active = categories.find((c) => c.id === activeId) || categories[0];

  const update = (field: keyof Category, value: any) => {
    setCategories((prev) => prev.map((c) => c.id === activeId ? { ...c, [field]: value } : c));
  };

  const addKeyword = (kw: string) => {
    if (!active.keywords.includes(kw)) update('keywords', [...active.keywords, kw]);
  };
  const removeKeyword = (kw: string) => update('keywords', active.keywords.filter((k) => k !== kw));

  const addInvalid = (kw: string) => {
    if (!active.invalidKeywords.includes(kw)) update('invalidKeywords', [...active.invalidKeywords, kw]);
  };
  const removeInvalid = (kw: string) => update('invalidKeywords', active.invalidKeywords.filter((k) => k !== kw));

  const addCategory = () => {
    const newCat: Category = {
      id: Date.now().toString(),
      name: 'Yeni Kategori',
      keywords: [],
      invalidKeywords: [],
      color: '#a855f7',
    };
    setCategories((prev) => [...prev, newCat]);
    setActiveId(newCat.id);
  };

  const deleteCategory = () => {
    if (categories.length <= 1) return;
    setCategories((prev) => prev.filter((c) => c.id !== activeId));
    setActiveId(categories[0].id);
  };

  const handleSave = () => {
    // Save to chrome.storage for use by the CUK engine
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ cukCategories: categories });
    } else {
      localStorage.setItem('cukCategories', JSON.stringify(categories));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 animate-in pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" /> CUK Kural Eğitimi
            <span className="text-xs font-normal text-muted-foreground">v2.0</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Kategoriler, anahtar kelimeler ve tekrar kademeleri.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Upload className="w-3.5 h-3.5" /> İçe Aktar
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> {saved ? 'Kaydedildi!' : 'Kaydet ve Uygula'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Kategoriler</span>
            {canEdit && (
              <button onClick={addCategory} className="w-6 h-6 rounded-full hover:bg-secondary flex items-center justify-center transition-colors">
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveId(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[14px] text-sm transition-all ${activeId === cat.id ? 'bg-primary/10 border border-primary/30 text-primary font-medium' : 'bg-card border border-border/50 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                  <span className="truncate text-left">{cat.name}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{cat.keywords.length}</Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {active && (
            <Card className="p-6 space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Kategori Adı</label>
                <Input
                  value={active.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="text-base font-bold"
                  disabled={!canEdit}
                />
              </div>

              {/* Keywords */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Anahtar Kelimeler</label>
                  <span className="text-[11px] text-muted-foreground">{active.keywords.length} kelime</span>
                </div>
                <TagInput
                  tags={active.keywords}
                  onAdd={addKeyword}
                  onRemove={removeKeyword}
                  placeholder="Kelime yaz, Enter ile ekle..."
                  disabled={!canEdit}
                />
                <p className="text-[11px] text-muted-foreground">Sistem bu kelimeleri yakaladığında cezayı bu kategoriye sokar.</p>
              </div>

              {/* Invalid keywords */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Otomatik Hatalı Anahtar Kelimeler
                </label>
                <TagInput
                  tags={active.invalidKeywords}
                  onAdd={addInvalid}
                  onRemove={removeInvalid}
                  placeholder="Hatalı kelime yaz, Enter ile ekle..."
                  disabled={!canEdit}
                />
                <p className="text-[11px] text-muted-foreground">Bu kelimeler bulunursa ceza anında <span className="text-destructive font-medium">Hatalı</span> işaretlenir.</p>
              </div>

              {/* Footer */}
              {canEdit && (
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={deleteCategory}>
                    <Trash2 className="w-3.5 h-3.5" /> Kategoriyi Sil
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="w-3.5 h-3.5" /> Kaydet
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
