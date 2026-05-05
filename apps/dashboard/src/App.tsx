import { useState } from 'react';
import { Settings, Terminal, ShieldAlert, AlignLeft, Box } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div className="flex h-screen bg-background text-textMain overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-border flex flex-col">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white shadow-lg shadow-primary/30">
            L
          </div>
          <span className="font-semibold text-lg tracking-tight">Lutheus Dash</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-primary/10 text-primary font-medium' : 'text-textMuted hover:bg-card hover:text-white'}`}
          >
            <Settings size={18} />
            <span>Genel Ayarlar</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('commands')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'commands' ? 'bg-primary/10 text-primary font-medium' : 'text-textMuted hover:bg-card hover:text-white'}`}
          >
            <Terminal size={18} />
            <span>Komutlar</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('moderation')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'moderation' ? 'bg-primary/10 text-primary font-medium' : 'text-textMuted hover:bg-card hover:text-white'}`}
          >
            <ShieldAlert size={18} />
            <span>Moderasyon</span>
          </button>

          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'logs' ? 'bg-primary/10 text-primary font-medium' : 'text-textMuted hover:bg-card hover:text-white'}`}
          >
            <AlignLeft size={18} />
            <span>Loglama</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 bg-background relative">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        
        <header className="mb-10 flex items-center justify-between z-10 relative">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {activeTab === 'settings' && 'Genel Ayarlar'}
              {activeTab === 'commands' && 'Komut Yönetimi'}
              {activeTab === 'moderation' && 'Moderasyon Modülleri'}
              {activeTab === 'logs' && 'Sistem Logları'}
            </h1>
            <p className="text-textMuted mt-1">Lutheus bot özelliklerini yönetin ve yapılandırın.</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-primary/25">
              Değişiklikleri Kaydet
            </button>
          </div>
        </header>

        <div className="max-w-4xl space-y-6 z-10 relative">
          {activeTab === 'settings' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-6 flex items-center space-x-2">
                <Box size={20} className="text-primary" />
                <span>Özelleştirilebilir Branding</span>
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-textMuted mb-1">Bot Adı</label>
                  <input type="text" className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" defaultValue="Lutheus Guard" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-textMuted mb-1">Bot Avatar URL</label>
                  <input type="text" className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-textMuted mb-1">Sunucu Adı</label>
                  <input type="text" className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" defaultValue="Lutheus" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-sidebar border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Komut</th>
                    <th className="px-6 py-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Açıklama</th>
                    <th className="px-6 py-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Erişim İzni (Roller)</th>
                    <th className="px-6 py-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-sidebar/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-primary">/ceza</td>
                    <td className="px-6 py-4 text-sm text-textMuted">Moderatör ceza komutları</td>
                    <td className="px-6 py-4">
                      <input type="text" defaultValue="@Moderatör, @Admin" className="bg-background border border-border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </td>
                  </tr>
                  <tr className="hover:bg-sidebar/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-primary">/karantina</td>
                    <td className="px-6 py-4 text-sm text-textMuted">Kullanıcıyı izole eder</td>
                    <td className="px-6 py-4">
                      <input type="text" defaultValue="@Admin" className="bg-background border border-border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </td>
                  </tr>
                  <tr className="hover:bg-sidebar/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-primary">/ticket</td>
                    <td className="px-6 py-4 text-sm text-textMuted">Destek talebi sistemi</td>
                    <td className="px-6 py-4">
                      <input type="text" defaultValue="@everyone" className="bg-background border border-border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-primary" />
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'moderation' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
              {[
                { name: 'Auto-Mod', desc: 'Küfür, reklam ve spam filtreleri.', active: true },
                { name: 'Karşılama Paneli', desc: 'Yeni üyelere görsel hoşgeldin mesajı.', active: true },
                { name: 'Ticket Sistemi', desc: 'Destek kanalı açma ve transkript kaydı.', active: true },
                { name: 'Karantina Sistemi', desc: 'Şüpheli hesap izolasyonu.', active: true },
                { name: 'Seviye ve XP Sistemi', desc: 'Kullanıcı aktifliğine göre rütbe.', active: false },
              ].map((mod, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg bg-background hover:border-primary/50 transition-colors">
                  <div>
                    <h3 className="font-semibold text-white">{mod.name}</h3>
                    <p className="text-sm text-textMuted mt-1">{mod.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={mod.active} />
                    <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
