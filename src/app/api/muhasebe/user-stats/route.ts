import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }

    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Yapılandırma eksik." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Muhasebe TÜM dosyaları görsün (admin ile aynı - cari/peşin/firma_cari fark etmez)
    const [profilesRes, filesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("visa_files").select("*, profiles:assigned_user_id(name)").order("created_at", { ascending: false }),
    ]);

    const profiles = profilesRes.data || [];
    const files = filesRes.data || [];

    // Dosyayı yapan: cari için cari_sahibi, diğerleri için assigned_user_id profili
    const getAssigneeKey = (f: { cari_sahibi?: string | null; assigned_user_id: string }) => {
      if (f.cari_sahibi) return f.cari_sahibi.toUpperCase();
      const prof = profiles.find((p: { id: string }) => p.id === f.assigned_user_id);
      return prof?.name?.toUpperCase() || f.assigned_user_id;
    };

    // Sahibe göre grupla (hiçbir dosya kaybolmasın)
    const ownerToFiles = new Map<string, typeof files>();
    files.forEach((f: { cari_sahibi?: string | null; assigned_user_id: string }) => {
      const key = getAssigneeKey(f) || "Bilinmeyen";
      if (!ownerToFiles.has(key)) ownerToFiles.set(key, []);
      ownerToFiles.get(key)!.push(f);
    });

    const order = ["BAHAR", "ERCAN", "YUSUF", "DAVUT"];
    const staffList = Array.from(ownerToFiles.entries())
      .map(([key, userFiles]) => {
        const firstFile = userFiles[0] as { assigned_user_id: string };
        const profile = profiles.find((p: { name?: string }) => p.name?.toUpperCase() === key)
          || profiles.find((p: { id: string }) => p.id === firstFile?.assigned_user_id)
          || { id: firstFile?.assigned_user_id || key, name: key, role: "staff" as const };
        return { profile, files: userFiles, totals: {} as Record<string, { borc: number; tahsilat: number; kalan: number }>, payments: [] as any[], bekleyenOdeme: 0 };
      })
      .sort((a, b) => {
        const aKey = a.profile.name?.toUpperCase() || "";
        const bKey = b.profile.name?.toUpperCase() || "";
        const ai = order.indexOf(aKey);
        const bi = order.indexOf(bKey);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return aKey.localeCompare(bKey);
      });

    return NextResponse.json({ staffList });
  } catch (err: any) {
    console.error("Muhasebe stats error:", err);
    return NextResponse.json({ error: err?.message || "Hata." }, { status: 500 });
  }
}