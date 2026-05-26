"use client";

// SECTION: ROLE_GUARDS
// PURPOSE: Moderation settings configuration including mute roles, mod roles, warn thresholds, and logging targets.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Hammer, Shield, AlertTriangle, Clock, HelpCircle } from "lucide-react";

export default function ModerationPage() {
  const { config, updateConfig, roles, channels } = useBotDashboardStore();

  if (!config) return null;

  // Read or initialize settings
  const settings = config.welcomeSettings || {
    channelId: "",
    welcomeMessage: "",
    goodbyeMessage: "",
    sendDm: false,
    embedEnabled: true,
  };

  const handleModuleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        moderation: !prev.modules.moderation,
      },
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Hammer className="w-6 h-6 text-[#66fcf1]" />
            <span>Moderasyon Modülü</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Sunucudaki yetkilendirmeleri, susturma kurallarını ve otomatik denetim log kanallarını ayarlayın.
          </p>
        </div>

        {/* Enable Toggle */}
        <button
          onClick={handleModuleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.moderation
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.moderation ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      {config.modules.moderation ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Roles Configuration */}
          <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#66fcf1]" />
              <span>Rol Tanımlamaları</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Susturma Rolü (Muted Role)</label>
                <select
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
                  defaultValue="204"
                >
                  <option value="">Otomatik Oluştur (Lutheus-Muted)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 font-light mt-1">
                  Susturulan kullanıcılara otomatik olarak verilecek rol.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Moderatör Rolleri</label>
                <select
                  multiple
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1] min-h-[100px]"
                  defaultValue={["202", "203"]}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 font-light mt-1">
                  Komutları kullanmaya ve ceza vermeye yetkili ek roller. (Ctrl tuşuna basarak çoklu seçebilirsiniz)
                </p>
              </div>
            </div>
          </div>

          {/* Thresholds & Logging */}
          <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#66fcf1]" />
              <span>Limitler & Cezalar</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Maksimum Uyarı Limiti</label>
                <select
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
                  defaultValue="3"
                >
                  <option value="3">3 Uyarı</option>
                  <option value="5">5 Uyarı</option>
                  <option value="10">10 Uyarı</option>
                </select>
                <p className="text-[10px] text-gray-500 font-light mt-1">
                  Bu limite ulaşan kullanıcılara otomatik olarak son ceza (Ban/Kick) uygulanır.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Otomatik Limit Aşım Cezası</label>
                <select
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
                  defaultValue="ban"
                >
                  <option value="ban">Sunucudan Yasakla (Ban)</option>
                  <option value="kick">Sunucudan At (Kick)</option>
                  <option value="mute">Süresiz Sustur (Mute)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Moderasyon Günlüğü Kanalı</label>
                <select
                  value={config.loggingSettings?.channelId || ""}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      loggingSettings: {
                        channelId: e.target.value,
                        events: prev.loggingSettings?.events || {
                          messageDelete: true,
                          messageEdit: true,
                          memberJoin: true,
                          memberLeave: true,
                          memberBan: true,
                          memberUnban: true,
                          roleUpdate: false,
                          channelUpdate: false,
                        },
                      },
                    }))
                  }
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1]"
                >
                  <option value="">Seçilmedi (Pasif)</option>
                  {channels.filter(c => c.type === 0).map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 font-light mt-1">
                  Moderasyon işlemlerinin detaylı loglarının gönderileceği kanal.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Moderasyon Modülü Kapalı</h3>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
            Ayarları değiştirebilmek için sağ üst köşeden "Modülü Aktif" butonuna basarak aktifleştirin.
          </p>
        </div>
      )}
    </div>
  );
}
