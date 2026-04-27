"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { TopNav } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/files": "Vize Dosyaları",
  "/admin/files/new": "Yeni Vize Dosyası",
  "/admin/bildirimler": "Bildirimler",
  "/admin/calendar": "Randevu Takvimi",
  "/admin/musteriler": "Tüm Müşteriler",
  "/admin/vize-bitisi": "Vize Bitiş Takibi",
  "/admin/groups": "Gruplar",
  "/admin/raporlar": "Raporlar",
  "/admin/payments": "Ödemeler",
  "/admin/kasa": "Kasa",
  "/admin/cari-hesap": "Cari Hesap",
  "/admin/aylik-ozet-rapor": "Aylık vize özeti",
  "/admin/logs": "Sistem Logları",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Yönetim Paneli";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string>("");

  // Tarayıcı sekme başlığını "Visora — {şirket}" yap
  useEffect(() => {
    if (typeof document !== "undefined") {
      const base = orgName ? `Visora — ${orgName}` : "Visora";
      document.title = title ? `${title} · ${base}` : base;
    }
  }, [title, orgName]);

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
            role: "admin",
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

      if (profileData.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profileData.organization_id)
          .single();
        if (org?.name) setOrgName(org.name);
      }
    }

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600 blur-3xl animate-blob" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-fuchsia-600 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
        </div>
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-sm ring-1 ring-white/10 flex items-center justify-center shadow-[0_20px_60px_-20px_rgba(99,102,241,0.6)] animate-float">
            <Image src="/visora-logo.png" alt="Visora" width={56} height={56} priority className="object-contain" />
          </div>
          <div className="w-8 h-8 border-4 border-white/10 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm tracking-wide">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav variant="admin" userName={profile?.name || "Admin"} orgName={orgName} />
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-6">{children}</main>
    </div>
  );
}
