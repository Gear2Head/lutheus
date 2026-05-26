"use client";

// SECTION: SETTINGS_PANEL
// PURPOSE: General server-specific bot configuration settings page.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Globe, Clock, Terminal, ShieldAlert, Sparkles, Database } from "lucide-react";

export default function GeneralSettingsPage() {
  const { config, updateConfig, roles } = useBotDashboardStore();

  if (!config) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-[#66fcf1]" />
          <span>Genel Ayarlar</span>
        </h1>
        <p className="text-xs text-[#c5c6c7] font-light mt-1">
          Lutheus'un bu sunucu özelindeki dil, prefix, saat dilimi ve temel çalışma ayarlarını yapın.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Language & Timezone */}
        <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#66fcf1]" />
            <span>Dil & Zaman Dilimi</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Bot Arayüz Dili</label>
              <select
                value={config.language}
                onChange={(e) => updateConfig((prev) => ({ ...prev, language: e.target.value }))}
                className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
              >
                <option value="tr">Türkçe (TR)</option>
                <option value="en">English (US)</option>
                <option value="de">Deutsch (DE)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Zaman Dilimi</label>
              <select
                value={config.timezone}
                onChange={(e) => updateConfig((prev) => ({ ...prev, timezone: e.target.value }))}
                className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
              >
                <option value="Europe/Istanbul">İstanbul (GMT+3)</option>
                <option value="UTC">UTC / GMT</option>
                <option value="America/New_York">New York (EST/EDT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Command Prefix & Access Control */}
        <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#66fcf1]" />
            <span>Ön Ek & Erişim Kontrolü</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Komut Ön Eki (Prefix)</label>
              <input
                type="text"
                maxLength={3}
                value={config.prefix}
                onChange={(e) => updateConfig((prev) => ({ ...prev, prefix: e.target.value }))}
                className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
                placeholder="!"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Panel Erişim Rolü</label>
              <select
                value={config.dashboardAccessRole || ""}
                onChange={(e) => updateConfig((prev) => ({ ...prev, dashboardAccessRole: e.target.value || undefined }))}
                className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
              >
                <option value="">Yalnızca Sunucu Sahibi / Yöneticiler</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data Retention & Storage */}
        <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6 md:col-span-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#66fcf1]" />
            <span>Veri Saklama Süresi</span>
          </h3>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white mb-1">Log & Geçmiş Saklama Limiti</label>
              <p className="text-[11px] text-[#c5c6c7] font-light leading-relaxed">
                Yapay zeka moderasyon logları, susturulma kayıtları ve ceza geçmişinin Firestore veritabanımızda kaç gün saklanacağını belirleyin.
              </p>
            </div>
            
            <div className="w-full md:w-64 shrink-0">
              <select
                value={config.dataRetentionDays}
                onChange={(e) => updateConfig((prev) => ({ ...prev, dataRetentionDays: Number(e.target.value) }))}
                className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
              >
                <option value={7}>7 Gün (Minimum)</option>
                <option value={15}>15 Gün</option>
                <option value={30}>30 Gün (Varsayılan)</option>
                <option value={90}>90 Gün (Gelişmiş)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
