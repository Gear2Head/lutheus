"use client";

// SECTION: DASHBOARD_RENDER
// PURPOSE: Guild home dashboard presenting key modules, statistics and quick navigations mimicking Sapphire's home experience.

import Link from "next/navigation";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import {
  MessageSquare,
  Shield,
  FileText,
  UserPlus,
  Compass,
  Zap,
  HelpCircle,
  ExternalLink,
  Bot
} from "lucide-react";

export default function GuildDashboardHomePage() {
  const { selectedGuild, config, channels, roles, commands } = useBotDashboardStore();

  const activeModulesCount = config
    ? Object.values(config.modules).filter(Boolean).length
    : 0;

  const quickStats = [
    { name: "Aktif Modüller", value: `${activeModulesCount} / 8`, desc: "Etkinleştirilmiş özellikler", icon: Zap, color: "text-[#66fcf1]" },
    { name: "Roller", value: roles.length.toString(), desc: "Sunucudaki toplam rol sayısı", icon: Shield, color: "text-purple-400" },
    { name: "Kanallar", value: channels.length.toString(), desc: "Okunan toplam kanal sayısı", icon: Compass, color: "text-blue-400" },
    { name: "Komutlar", value: commands.length.toString(), desc: "Kullanılabilir slash komutlar", icon: Bot, color: "text-emerald-400" },
  ];

  const controlCards = [
    {
      name: "Custom Messages",
      desc: "Sunucunuza özel otomatik mesaj tetikleyicileri ve embed şablonları oluşturun.",
      href: "messages",
      icon: MessageSquare,
      status: config?.modules.welcomeMessages ? "Aktif" : "Pasif",
    },
    {
      name: "Moderation Cases",
      desc: "Yapay zeka ve moderatörler tarafından verilen cezaları, uyarıları ve geçmişi inceleyin.",
      href: "moderation",
      icon: Shield,
      status: config?.modules.moderation ? "Aktif" : "Pasif",
    },
    {
      name: "User Reports",
      desc: "Sunucu üyelerinin şüpheli durumlar hakkında yetkililere gönderdiği rapor kayıtları.",
      href: "logging",
      icon: FileText,
      status: config?.modules.logging ? "Aktif" : "Pasif",
    },
    {
      name: "Role Greetings",
      desc: "Sunucuya yeni katılan kullanıcılara veya botlara otomatik rol atama kuralları.",
      href: "join-roles",
      icon: UserPlus,
      status: config?.modules.joinRoles ? "Aktif" : "Pasif",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-[#1f2833]/80 to-[#1f2833]/20 border border-[#2f3e46] p-8 rounded-3xl overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#66fcf1]/5 rounded-full blur-[60px] pointer-events-none" />
        <h1 className="text-3xl font-extrabold text-white">
          Hoş geldin, <span className="text-[#66fcf1]">{selectedGuild?.name || "Yönetici"}</span>!
        </h1>
        <p className="text-sm text-[#c5c6c7] font-light mt-2 max-w-xl">
          Lutheus AI Moderasyon Dashboard'una başarıyla bağlandınız. Sunucunuzu optimize etmek için sol menüden özellikleri özelleştirebilirsiniz.
        </p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {quickStats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.name} className="bg-[#1f2833]/40 border border-[#2f3e46] p-5 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">{s.name}</span>
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <h2 className="text-2xl font-bold text-white mt-1">{s.value}</h2>
              <span className="text-[10px] text-gray-500 font-light mt-0.5">{s.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Module Overview Section */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Sık Kullanılan Kontrol Kartları</h3>
          <span className="text-xs text-[#66fcf1] font-light">hızlı yönlendirme</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {controlCards.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.name}
                href={`/bot/${selectedGuild?.id}/${c.href}`}
                className="group p-6 bg-[#1f2833]/40 hover:bg-[#1f2833]/80 border border-[#2f3e46] hover:border-[#66fcf1]/40 rounded-2xl transition-all duration-300 flex items-start gap-5 hover:-translate-y-0.5"
              >
                <div className="p-3 bg-[#1c2331] rounded-xl text-[#66fcf1] border border-[#2f3e46] group-hover:border-[#66fcf1]/30 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-white group-hover:text-[#66fcf1] transition-colors truncate">
                      {c.name}
                    </h4>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        c.status === "Aktif"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#c5c6c7] font-light mt-2 leading-relaxed">
                    {c.desc}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Support & Community Section */}
      <div className="bg-[#1f2833]/30 border border-[#2f3e46]/60 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Yardım veya Desteğe mi İhtiyacınız Var?</h4>
            <p className="text-xs text-[#c5c6c7] font-light mt-1">
              Topluluk Discord sunucumuza katılarak güncellemelere göz atabilir ve destek ekibimizden yardım alabilirsiniz.
            </p>
          </div>
        </div>

        <a
          href="https://discord.gg/sapphire"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)] shrink-0"
        >
          <span>Destek Sunucusu</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
