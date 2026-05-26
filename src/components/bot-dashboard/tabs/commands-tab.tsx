"use client";

// SECTION: ADMIN_TABLE
// PURPOSE: Discord command customization list showing all slash commands, cooldown configurations, permissions, and sync triggers.

import { useState } from "react";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Search, Shield, Clock, ToggleLeft, ToggleRight, Sparkles, RefreshCw } from "lucide-react";

export default function CommandsPage() {
  const { commands, roles, triggerBotAction, showToast } = useBotDashboardStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Local state changes trigger global state
  const [localCommands, setLocalCommands] = useState(commands);

  const handleToggle = (id: string) => {
    setLocalCommands((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
    showToast("Komut ayarı yerel olarak değiştirildi, alt bardan kaydedin.", "info");
    // Under typical workflow, this would also write to store config, but commands list usually saved in discrete settings.
  };

  const handleSyncCommands = async () => {
    setSyncing(true);
    try {
      const res = await triggerBotAction("sync_commands");
      if (res.success) {
        showToast("Slash komutları sunucu ile başarıyla senkronize edildi!", "success");
      } else {
        showToast(res.message || "Senkronizasyon başarısız", "error");
      }
    } catch {
      showToast("Bir ağ hatası oluştu", "error");
    } finally {
      setSyncing(false);
    }
  };

  const filtered = localCommands.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TerminalIcon className="w-6 h-6 text-[#66fcf1]" />
            <span>Slash Komutları</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Sunucuda bot tarafından sunulan slash komutların cooldown, yetki ve aktiflik durumlarını yönetin.
          </p>
        </div>

        <button
          onClick={handleSyncCommands}
          disabled={syncing}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#1f2833]/80 hover:bg-[#1c2331] border border-[#2f3e46] hover:border-[#66fcf1]/40 rounded-xl text-xs font-bold text-[#66fcf1] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          <span>Discord'a Senkronize Et</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-gray-500" />
        <input
          type="text"
          placeholder="Komut adı veya açıklaması arayın..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#1f2833]/40 border border-[#2f3e46] hover:border-[#66fcf1]/30 rounded-xl pl-12 pr-4 py-3 text-xs text-white focus:outline-none focus:border-[#66fcf1] transition-colors"
        />
      </div>

      {/* Command List Table */}
      <div className="bg-[#1f2833]/40 border border-[#2f3e46] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2f3e46] text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-[#1c2331]/30">
                <th className="px-6 py-4">Komut Adı</th>
                <th className="px-6 py-4">Açıklama</th>
                <th className="px-6 py-4">Zorunlu Rol</th>
                <th className="px-6 py-4">Cooldown</th>
                <th className="px-6 py-4 text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2f3e46]/30 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                    Komut bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1c2331]/30 transition-colors">
                    {/* Command Name */}
                    <td className="px-6 py-4 font-bold text-[#66fcf1]">
                      /{c.name}
                    </td>

                    {/* Description */}
                    <td className="px-6 py-4 text-[#c5c6c7] font-light max-w-xs truncate" title={c.description}>
                      {c.description}
                    </td>

                    {/* Required Role */}
                    <td className="px-6 py-4">
                      <select
                        value={c.requiredRole || ""}
                        onChange={() => {}}
                        className="bg-[#1c2331] border border-[#2f3e46] rounded-lg px-2 py-1 text-[11px] text-[#c5c6c7] focus:outline-none focus:border-[#66fcf1]"
                      >
                        <option value="">Herkes (@everyone)</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Cooldown */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <input
                          type="number"
                          min={0}
                          max={300}
                          defaultValue={c.cooldown || 0}
                          className="w-12 bg-[#1c2331] border border-[#2f3e46] rounded-lg px-1.5 py-0.5 text-center text-[11px] text-white focus:outline-none focus:border-[#66fcf1]"
                        />
                        <span className="text-[10px] font-light">sn</span>
                      </div>
                    </td>

                    {/* Active/Inactive Switch */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(c.id)}
                        className="focus:outline-none transition-colors"
                      >
                        {c.enabled ? (
                          <ToggleRight className="w-7 h-7 text-[#66fcf1]" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-gray-600" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TerminalIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
