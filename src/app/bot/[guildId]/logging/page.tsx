"use client";

// SECTION: STATE_STORE
// PURPOSE: Logging module toggles and target channel selector page.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { ClipboardList, Settings, HelpCircle, Shield } from "lucide-react";

export default function LoggingPage() {
  const { config, updateConfig, channels } = useBotDashboardStore();

  if (!config) return null;

  const logSettings = config.loggingSettings || {
    channelId: "",
    events: {
      messageDelete: true,
      messageEdit: true,
      memberJoin: true,
      memberLeave: true,
      memberBan: true,
      memberUnban: true,
      roleUpdate: false,
      channelUpdate: false,
    },
  };

  const handleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: { ...prev.modules, logging: !prev.modules.logging },
    }));
  };

  const handleEventToggle = (key: keyof typeof logSettings.events) => {
    updateConfig((prev) => ({
      ...prev,
      loggingSettings: {
        channelId: logSettings.channelId,
        events: {
          ...logSettings.events,
          [key]: !logSettings.events[key],
        },
      },
    }));
  };

  const eventsList = [
    { key: "messageDelete", label: "Silinen Mesajlar", desc: "Bir üye mesaj sildiğinde log gönderir." },
    { key: "messageEdit", label: "Düzenlenen Mesajlar", desc: "Bir üye mesajını güncellediğinde log gönderir." },
    { key: "memberJoin", label: "Katılan Üyeler", desc: "Sunucuya yeni biri katıldığında log gönderir." },
    { key: "memberLeave", label: "Ayrılan Üyeler", desc: "Bir üye sunucudan çıktığında log gönderir." },
    { key: "memberBan", label: "Yasaklanan Üyeler", desc: "Bir üye yasaklandığında detaylı bilgi gönderir." },
    { key: "memberUnban", label: "Yasağı Kaldırılanlar", desc: "Yasağı kaldırılan üyelerin kaydını tutar." },
    { key: "roleUpdate", label: "Rol Güncellemeleri", desc: "Rol oluşturma, silme veya izin değişiklikleri." },
    { key: "channelUpdate", label: "Kanal Değişiklikleri", desc: "Kanal oluşturma, silme veya isim güncellemeleri." },
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#66fcf1]" />
            <span>Denetim Kayıtları (Logging)</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Sunucunuzda gerçekleşen olayları anlık izleyin ve belirlediğiniz kanallara log gönderilmesini sağlayın.
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.logging
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.logging ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      {config.modules.logging ? (
        <div className="space-y-6">
          {/* Target Channel */}
          <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#66fcf1]" />
              <span>Log Kanalı</span>
            </h3>

            <div className="max-w-md">
              <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Denetim Günlüğü Gönderim Kanalı</label>
              <select
                value={logSettings.channelId}
                onChange={(e) =>
                  updateConfig((prev) => ({
                    ...prev,
                    loggingSettings: {
                      ...logSettings,
                      channelId: e.target.value,
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
            </div>
          </div>

          {/* Event Toggles Grid */}
          <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#66fcf1]" />
              <span>Takip Edilecek Olaylar</span>
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {eventsList.map((e) => (
                <div
                  key={e.key}
                  className="flex items-start justify-between p-4 bg-[#1c2331]/50 border border-[#2f3e46]/50 rounded-xl hover:border-[#66fcf1]/20 transition-all"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <h4 className="text-xs font-bold text-white">{e.label}</h4>
                    <p className="text-[10px] text-gray-500 font-light mt-0.5 leading-relaxed">
                      {e.desc}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!logSettings.events[e.key as keyof typeof logSettings.events]}
                    onChange={() => handleEventToggle(e.key as keyof typeof logSettings.events)}
                    className="w-4 h-4 rounded border-gray-300 text-[#66fcf1] focus:ring-[#66fcf1] shrink-0 mt-0.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Logging Modülü Kapalı</h3>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
            Ayarları değiştirebilmek için sağ üst köşeden "Modülü Aktif" butonuna basarak aktifleştirin.
          </p>
        </div>
      )}
    </div>
  );
}
