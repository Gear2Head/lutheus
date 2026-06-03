import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../contexts/ToastContext';
import {
  Megaphone, Plus, Send, Archive, Eye, X, Users,
  ChevronDown, ChevronUp, Bold, Italic, Link, List,
  RefreshCw, CheckCircle, Clock, FileText
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

// SECTION: ANNOUNCEMENTS_PAGE
// PURPOSE: Admin-only page for creating and publishing Discord DM announcements to eligible staff.
// Mutations go through /api/admin/announcements (service-role); client never writes directly.

interface Announcement {
  id: string;
  title: string;
  body_markdown: string;
  target_roles: string[];
  created_by_discord_id: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  discord_moderatoru: 'Discord Moderatoru',
  kidemli_discord_moderatoru: 'Kidemli Moderator',
  senior_moderator: 'Senior Moderator',
  discord_destek_ekibi: 'Destek Ekibi',
  discord_yoneticisi: 'Discord Yoneticisi',
  genel_sorumlu: 'Genel Sorumlu',
  yonetici: 'Yonetici',
  admin: 'Admin',
  kurucu: 'Kurucu',
};

const STATUS_CONFIG = {
  draft: { label: 'Taslak', variant: 'warning' as const, icon: FileText },
  published: { label: 'Yayinlandi', variant: 'success' as const, icon: CheckCircle },
  archived: { label: 'Arsivlendi', variant: 'default' as const, icon: Archive },
};

const ALL_TARGET_ROLES = [
  'discord_moderatoru',
  'kidemli_discord_moderatoru',
  'senior_moderator',
  'discord_destek_ekibi',
];

function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = markdown
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary underline">$1</a>')
    .replace(/^- (.+)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^## (.+)/gm, '<h2 class="text-base font-bold mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)/gm, '<h1 class="text-lg font-bold mt-3 mb-1">$1</h1>')
    .replace(/\n/g, '<br/>');
  return <div className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Announcements() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRoles, setTargetRoles] = useState<string[]>([...ALL_TARGET_ROLES]);
  const [previewMode, setPreviewMode] = useState(false);

  // Expanded detail
  const [expanded, setExpanded] = useState<string | null>(null);

  const canManage = session ? hasPermission(session.role, 'announcement:manage') : false;

  const loadData = async () => {
    setLoading(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      const data = await AdminApiClient.listAnnouncements();
      setItems(data || []);
    } catch (err: any) {
      showToast(`Duyurular yuklenemedi: ${err?.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const insertMarkdown = (syntax: string, wrap = false) => {
    const ta = document.getElementById('ann-body') as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    let inserted = '';
    if (wrap && selected) {
      inserted = `${syntax}${selected}${syntax}`;
    } else {
      inserted = syntax + (selected || 'metin');
    }
    const next = body.slice(0, start) + inserted + body.slice(end);
    setBody(next);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + inserted.length;
      ta.selectionEnd = start + inserted.length;
    }, 0);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      const item = await AdminApiClient.createAnnouncement(title.trim(), body.trim(), targetRoles);
      showToast('Duyuru taslak olarak olusturuldu.', 'success');
      setItems(prev => [item, ...prev]);
      setTitle('');
      setBody('');
      setTargetRoles([...ALL_TARGET_ROLES]);
      setCreateOpen(false);
    } catch (err: any) {
      showToast(`Duyuru olusturulamadi: ${err?.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      await AdminApiClient.publishAnnouncement(id, items.find(i => i.id === id)?.target_roles);
      showToast('Duyuru yayinlandi ve bot dispatch kuyruklandi.', 'success');
      await loadData();
    } catch (err: any) {
      showToast(`Yayinlama basarisiz: ${err?.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      const res = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.idToken}` },
        body: JSON.stringify({ id, action: 'archive' })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'API_ERROR');
      showToast('Duyuru arsivlendi.', 'success');
      await loadData();
    } catch (err: any) {
      showToast(`Arsivleme basarisiz: ${err?.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 bg-card border border-border/50 rounded-[24px] p-8 glass-panel animate-in">
        <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
          <Megaphone className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">Yetersiz Yetki</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Duyuru yonetimi icin yonetici yetkisi gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Duyurular</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Discord DM ile yetkililere gonderilen duyurular</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-secondary/50 border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold">
            <Plus className="w-4 h-4" /> Yeni Duyuru
          </Button>
        </div>
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[12px] p-4">
          <div className="relative w-full max-w-2xl bg-card border border-border/60 shadow-2xl rounded-2xl overflow-hidden animate-in">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">Yeni Duyuru Olustur</h3>
              </div>
              <button onClick={() => setCreateOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Baslik</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Duyuru basligini girin..."
                  required
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
                />
              </div>

              {/* Target Roles */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Hedef Roller
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_TARGET_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        targetRoles.includes(role)
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'bg-secondary/40 border-border/50 text-muted-foreground'
                      }`}
                    >
                      {ROLE_LABELS[role] || role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Markdown Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Icerik (Markdown)</label>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(p => !p)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3" /> {previewMode ? 'Duzenle' : 'Onizle'}
                  </button>
                </div>

                {!previewMode ? (
                  <>
                    <div className="flex gap-1 px-2 py-1.5 rounded-t-xl bg-secondary/40 border border-border/50 border-b-0">
                      {[
                        { icon: Bold, action: () => insertMarkdown('**', true), title: 'Kalin' },
                        { icon: Italic, action: () => insertMarkdown('*', true), title: 'Italik' },
                        { icon: Link, action: () => insertMarkdown('[metin](url)'), title: 'Link' },
                        { icon: List, action: () => insertMarkdown('- '), title: 'Liste' },
                      ].map(({ icon: Icon, action, title: t }) => (
                        <button
                          key={t}
                          type="button"
                          onClick={action}
                          title={t}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="ann-body"
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      placeholder="Duyuru icerigini yazin... (Markdown desteklenir)"
                      required
                      rows={8}
                      className="w-full px-3 py-2.5 rounded-b-xl bg-secondary/30 border border-border/50 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none placeholder:text-muted-foreground"
                    />
                  </>
                ) : (
                  <div className="min-h-[200px] px-4 py-3 rounded-xl bg-secondary/20 border border-border/50">
                    {body ? <MarkdownPreview markdown={body} /> : (
                      <p className="text-sm text-muted-foreground italic">Icerik bos.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Iptal</Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  disabled={saving || !title.trim() || !body.trim() || targetRoles.length === 0}
                >
                  {saving ? 'Olusturuluyor...' : 'Taslak Kaydet'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-6 h-6" />}
          title="Henuz duyuru olusturulmamis"
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const cfg = STATUS_CONFIG[item.status];
            const StatusIcon = cfg.icon;
            const isExpanded = expanded === item.id;
            return (
              <Card key={item.id} className="overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="w-full flex items-start gap-4 p-5 text-left hover:bg-secondary/20 transition-colors"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <StatusIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-sm text-foreground truncate">{item.title}</span>
                      <Badge variant={cfg.variant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(item.created_at)}
                      </span>
                      {item.published_at && (
                        <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          {formatDateTime(item.published_at)}
                        </span>
                      )}
                      <div className="flex gap-1 flex-wrap">
                        {(item.target_roles || []).map(r => (
                          <span key={r} className="px-1.5 py-0.5 rounded-md bg-secondary/60 text-[10px] text-muted-foreground font-medium">
                            {ROLE_LABELS[r] || r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border/30 pt-4">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border/40">
                      <MarkdownPreview markdown={item.body_markdown} />
                    </div>

                    {/* Actions */}
                    {item.status === 'draft' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(item.id)}
                          disabled={saving}
                          className="text-muted-foreground"
                        >
                          <Archive className="w-3.5 h-3.5 mr-1" /> Arsivle
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePublish(item.id)}
                          disabled={saving}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> {saving ? 'Gonderiliyor...' : 'Yayinla ve Gonder'}
                        </Button>
                      </div>
                    )}
                    {item.status === 'published' && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(item.id)}
                          disabled={saving}
                          className="text-muted-foreground"
                        >
                          <Archive className="w-3.5 h-3.5 mr-1" /> Arsivle
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
