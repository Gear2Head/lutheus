"use client";

// SECTION: ROLE_GUARDS
// PURPOSE: Role connection metadata and verification provider options.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { FolderLock, HelpCircle } from "lucide-react";

export default function RoleConnectionsPage() {
  const { config, updateConfig } = useBotDashboardStore();

  if (!config) return null;

  const handleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: { ...prev.modules, roleConnections: !prev.modules.roleConnections },
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderLock className="w-6 h-6 text-[#66fcf1]" />
            <span>Role Connections (Bağlantılı Roller)</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Steam, GitHub, Twitter gibi harici hesaplarını doğrulayan kullanıcılara otomatik verilecek rolleri tanımlayın.
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.roleConnections
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.roleConnections ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
        <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
        <h3 className="text-sm font-bold text-gray-400">Rol Bağlantıları Bulunmuyor</h3>
        <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
          Bağlantılı hesap kuralları ve Discord Entegrasyon Metadata yapılandırması Premium pakette aktiftir.
        </p>
      </div>
    </div>
  );
}
