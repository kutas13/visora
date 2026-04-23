"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { StaffSidebar, TopBar } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

const pageTitles: Record<string, string> = {
  "/app": "Ana Sayfa",
  "/app/files": "Vize Dosyaları",
  "/app/files/new": "Yeni Vize Dosyası",
  "/app/calendar": "Randevu Takvimi",
  "/app/vize-bitisi": "Vize Bitiş Takibi",
  "/app/groups": "Gruplar",
  "/app/payments": "Ödemeler",
  "/app/atamalar": "iDATA Atamalarım",
  "/app/cari-hesap": "Cari Hesabım",
  "/app/bildirimler": "Bildirimler",
  "/app/whatsapp": "WhatsApp Bildirimler",
  "/app/gunluk-rapor": "Günlük Rapor",
  "/app/randevu-listesi": "Randevu Alınacak",
  "/app/randevu-raporlari": "Randevu Raporları",
  "/app/musteriler": "Müşterilerim",
  "/app/aylik-ozet-rapor": "Aylık özet raporu",
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Fox Turizm";
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sayfa degisince sidebar kapat (mobil)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setLoading(false);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        if (profileData.name === "ZAFER" && window.location.pathname === "/app") {
          router.replace("/app/randevu-listesi");
        }
      }
    }

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 animate-pulse">
            <span className="text-white font-bold text-2xl">F</span>
          </div>
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-navy-500">{"Yükleniyor..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Overlay - mobilde sidebar acikken */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobilde slide-in */}
      <div className={`
        fixed left-0 top-0 h-full z-50
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <StaffSidebar />
      </div>

      {/* Main Content */}
      <div className="lg:ml-72">
        <TopBar
          title={title}
          userName={profile?.name || "Kullanıcı"}
          variant="staff"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
