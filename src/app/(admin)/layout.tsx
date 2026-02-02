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
  "/admin/payments": "Ödemeler",
  "/admin/logs": "Sistem Logları",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Yönetim Paneli";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/admin");
        return;
      }

      // Profili çek
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      console.log("Admin layout profile:", { profileData, profileError });

      // Profil yoksa veya hata varsa, profil oluşturmayı dene
      if (profileError || !profileData) {
        console.log("No profile found, trying to create...");
        
        // Profil oluştur
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
        
        // Tekrar çek
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (newProfile) {
          setProfile(newProfile);
        } else {
          // Profil oluşturulamadıysa da devam et
          setProfile({ id: user.id, name: "Admin", role: "admin" } as Profile);
        }
        setLoading(false);
        return;
      }

      // Profil var ama admin değilse
      if (profileData.role !== "admin") {
        console.log("User is not admin, redirecting...");
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
          <p className="text-navy-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <AdminSidebar />
      <div className="ml-72">
        <TopBar title={title} userName={profile?.name || "Admin"} variant="admin" />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
