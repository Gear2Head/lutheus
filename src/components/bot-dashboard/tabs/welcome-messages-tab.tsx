"use client";

// SECTION: STATE_STORE
// PURPOSE: Welcome and goodbye message template editor including variable mappings and Discord preview rendering.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { MessageSquare, HelpCircle, Eye, AlertCircle } from "lucide-react";

export default function WelcomeMessagesPage() {
  const { config, updateConfig, channels, triggerBotAction, showToast } = useBotDashboardStore();

  if (!config) return null;

  const settings = config.welcomeSettings || {
    channelId: "",
    welcomeMessage: "Aramıza hoş geldin {user}!",
    goodbyeMessage: "{user} aramızdan ayrıldı.",
    sendDm: false,
    embedEnabled: true,
  };

  const handleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: { ...prev.modules, welcomeMessages: !prev.modules.welcomeMessages },
    }));
  };

  const handleUpdate = (key: string, value: unknown) => {
    updateConfig((prev) => ({
      ...prev,
      welcomeSettings: {
        ...settings,
        [key]: value,
      },
    }));
  };

  const handleTestWelcome = async () => {
    try {
      const res = await triggerBotAction("test_welcome");
      if (res.success) {
        showToast("Sunucuya test karşılama mesajı başarıyla gönderildi!", "success");
      } else {
        showToast(res.message || "Test başarısız oldu", "error");
      }
    } catch {
      showToast("Test gönderilirken hata oluştu", "error");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#66fcf1]" />
            <span>Karşılama & Uğurlama Mesajları</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Sunucunuza yeni giren veya ayrılan üyeleri karşılamak için özelleştirilmiş metin şablonları hazırlayın.
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.welcomeMessages
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.welcomeMessages ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      {config.modules.welcomeMessages ? (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Settings Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Gönderilecek Kanal</label>
                <select
                  value={settings.channelId}
                  onChange={(e) => handleUpdate("channelId", e.target.value)}
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

              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Karşılama Mesajı Şablonu</label>
                <textarea
                  rows={4}
                  value={settings.welcomeMessage}
                  onChange={(e) => handleUpdate("welcomeMessage", e.target.value)}
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1] font-mono leading-relaxed"
                  placeholder="Sunucuya hoş geldin {user}!"
                />
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-500 font-light">
                  <span>Değişkenler:</span>
                  <code className="bg-[#1c2331] px-1 py-0.5 rounded text-[#66fcf1]">{`{user}`}</code>
                  <code className="bg-[#1c2331] px-1 py-0.5 rounded text-[#66fcf1]">{`{server}`}</code>
                  <code className="bg-[#1c2331] px-1 py-0.5 rounded text-[#66fcf1]">{`{member_count}`}</code>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c6c7] mb-1.5">Uğurlama Mesajı Şablonu</label>
                <textarea
                  rows={3}
                  value={settings.goodbyeMessage}
                  onChange={(e) => handleUpdate("goodbyeMessage", e.target.value)}
                  className="w-full bg-[#1c2331] border border-[#2f3e46] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#66fcf1] font-mono leading-relaxed"
                  placeholder="{user} aramızdan ayrıldı."
                />
              </div>

              <div className="flex items-center justify-between border-t border-[#2f3e46]/60 pt-4">
                <div>
                  <h4 className="text-xs font-bold text-white">DM ile Gönder</h4>
                  <p className="text-[10px] text-gray-500 font-light mt-0.5">
                    Karşılama mesajını kullanıcıya özel mesaj olarak da gönderin.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sendDm}
                  onChange={(e) => handleUpdate("sendDm", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#66fcf1] focus:ring-[#66fcf1]"
                />
              </div>
            </div>

            {/* Test Action */}
            <div className="bg-[#1f2833]/30 border border-[#2f3e46]/60 p-6 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#66fcf1] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Ayarları Canlı Test Edin</h4>
                  <p className="text-[10px] text-gray-500 font-light mt-0.5">
                    Seçili log kanalına anlık test mesajı tetikleyerek görünümü doğrulayın.
                  </p>
                </div>
              </div>
              <button
                onClick={handleTestWelcome}
                className="px-4 py-2 bg-[#1f2833] hover:bg-[#1f2833]/80 border border-[#2f3e46] text-xs font-bold text-[#66fcf1] rounded-xl transition-all"
              >
                Test Gönder
              </button>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl h-fit space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2f3e46] pb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#66fcf1]" />
              <span>Canlı Önizleme (Mock)</span>
            </h3>

            {/* Discord message preview */}
            <div className="bg-[#0b0c10] border border-[#2f3e46] rounded-xl p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#66fcf1] to-purple-600 flex items-center justify-center text-xs font-bold text-[#0b0c10]">
                  L
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Lutheus</span>
                    <span className="bg-[#66fcf1]/10 text-[#66fcf1] text-[8px] font-bold px-1 py-0.5 rounded uppercase">Bot</span>
                    <span className="text-[9px] text-gray-500 font-light">Bugün 22:30</span>
                  </div>
                  
                  {/* Embed content box */}
                  <div className="mt-2 border-l-4 border-[#66fcf1] bg-[#1f2833]/50 p-3 rounded-r-lg max-w-xs">
                    <h4 className="text-xs font-bold text-white">Sunucuya Katıldı!</h4>
                    <p className="text-[11px] text-[#c5c6c7] font-light mt-1 whitespace-pre-wrap leading-relaxed">
                      {settings.welcomeMessage
                        .replace("{user}", "@Gear_Head")
                        .replace("{server}", "Lutheus Test Server")
                        .replace("{member_count}", "1421")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Karşılama Modülü Kapalı</h3>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
            Ayarları değiştirebilmek için sağ üst köşeden "Modülü Aktif" butonuna basarak aktifleştirin.
          </p>
        </div>
      )}
    </div>
  );
}
