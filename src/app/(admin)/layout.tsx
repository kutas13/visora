"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar, TopBar } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/files": "Vize Dosyaları",
  "/admin/bildirimler": "Bildirimler",
  "/admin/calendar": "Randevu Takvimi",
  "/admin/vize-bitisi": "Vize Bitiş Takibi",
  "/admin/groups": "Gruplar",
  "/admin/raporlar": "Raporlar",
  "/admin/payments": "Ödemeler",
  "/admin/atamalar": "iDATA Atamaları",
  "/admin/cari-hesap": "Cari Hesap",
  "/admin/logs": "Sistem Logları",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Yönetim Paneli";

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
        router.push("/admin");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        const { error: insertError } = await supabase
          .from("profiles")
          .upsert({ 
            id: user.id, 
            name: user.email?.split("@")[0]?.toUpperCase() || "ADMIN", 
            role: "admin" 
          });
        
        if (insertError) {
          console.error("Could not create profile:", insertError);
        }
        
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (newProfile) {
          setProfile(newProfile);
        } else {
          setProfile({ id: user.id, name: "Admin", role: "admin" } as Profile);
        }
        setLoading(false);
        return;
      }

      if (profileData.role !== "admin") {
        router.push("/app");
        return;
      }

      setProfile(profileData);
      setLoading(false);
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
        <AdminSidebar />
        {/* Mobilde kapat butonu */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-[-44px] w-10 h-10 bg-navy-800 text-white rounded-r-xl flex items-center justify-center shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="lg:ml-72">
        <TopBar
          title={title}
          userName={profile?.name || "Admin"}
          variant="admin"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
