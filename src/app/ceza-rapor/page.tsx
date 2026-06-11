"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Handles seamless client-side redirection to the legacy Ceza Rapor admin panel.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function CezaRaporRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect instantly to the copied static admin panel
    window.location.href = "/dashboard";
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c10] flex flex-col items-center justify-center gap-4 text-gray-400">
      <Loader2 className="w-8 h-8 text-[#66fcf1] animate-spin" />
      <p className="text-xs font-semibold tracking-wider uppercase">Ceza Rapor Sistemine Yönlendiriliyorsunuz...</p>
    </div>
  );
}
