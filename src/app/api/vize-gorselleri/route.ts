import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function ensureBucket(sb: ReturnType<typeof adminClient>) {
  try {
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b: any) => b.id === "uploads")) {
      await sb.storage.createBucket("uploads", { public: true });
    }
  } catch (e: any) {
    console.error("[ensureBucket]", e?.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const sb = adminClient();

    const { error: tableCheck } = await sb.from("vize_gorselleri_uploads").select("id").limit(0);
    if (tableCheck) {
      console.error("[GET] Table check failed:", tableCheck.message, tableCheck.code);
      return NextResponse.json({ data: [], tableError: tableCheck.message, tableCode: tableCheck.code });
    }

    let query = sb
      .from("vize_gorselleri_uploads")
      .select("*, profiles:user_id(name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET error]", error.message, error.code);
      return NextResponse.json({ data: [], queryError: error.message });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error("[GET catch]", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz - oturum bulunamadı" }, { status: 401 });

    const sb = adminClient();

    let body: any;
    try {
      body = await req.json();
    } catch (e: any) {
      return NextResponse.json({ error: "JSON parse hatası: " + e.message }, { status: 400 });
    }

    const { action } = body;

    if (action === "health") {
      const checks: Record<string, any> = { user: user.id };

      const { error: tErr } = await sb.from("vize_gorselleri_uploads").select("id").limit(0);
      checks.table = tErr ? { ok: false, error: tErr.message, code: tErr.code } : { ok: true };

      try {
        const { data: buckets } = await sb.storage.listBuckets();
        const bucket = buckets?.find((b: any) => b.id === "uploads");
        checks.bucket = bucket ? { ok: true, public: bucket.public } : { ok: false };
        if (!bucket) {
          const { error: cErr } = await sb.storage.createBucket("uploads", { public: true });
          checks.bucketCreated = cErr ? { ok: false, error: cErr.message } : { ok: true };
        }
      } catch (e: any) {
        checks.bucket = { ok: false, error: e.message };
      }

      return NextResponse.json({ checks });
    }

    if (action === "upload_single") {
      const { base64, contentType, siraNo } = body;
      if (!base64) return NextResponse.json({ error: "base64 verisi eksik" }, { status: 400 });

      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const bytes = Buffer.from(base64Data, "base64");
      const storagePath = `vize-gorselleri/${user.id}/${Date.now()}-${siraNo}.jpg`;

      await ensureBucket(sb);

      const { error: uploadErr } = await sb.storage
        .from("uploads")
        .upload(storagePath, bytes, { contentType: contentType || "image/jpeg", upsert: true });

      if (uploadErr) {
        console.error("[Storage]", JSON.stringify(uploadErr));
        return NextResponse.json({ error: "Storage: " + uploadErr.message }, { status: 500 });
      }

      const { data: urlData } = sb.storage.from("uploads").getPublicUrl(storagePath);

      const { data: row, error: insertErr } = await sb
        .from("vize_gorselleri_uploads")
        .insert({
          user_id: user.id,
          gorsel_url: urlData.publicUrl,
          gorsel_adi: String(siraNo),
          sira_no: Number(siraNo),
        })
        .select("*")
        .single();

      if (insertErr) {
        console.error("[DB insert]", JSON.stringify(insertErr));
        return NextResponse.json({ error: "DB: " + insertErr.message }, { status: 500 });
      }

      return NextResponse.json({ data: row, ok: true });
    }

    if (action === "save") {
      const { items } = body;
      if (!items?.length) return NextResponse.json({ error: "Eksik veri" }, { status: 400 });

      const results: any[] = [];
      for (const item of items) {
        const { data: row, error: err } = await sb
          .from("vize_gorselleri_uploads")
          .insert({ user_id: user.id, gorsel_url: item.gorsel_url, gorsel_adi: item.gorsel_adi, sira_no: item.sira_no })
          .select("*")
          .single();
        if (!err && row) results.push(row);
      }
      return NextResponse.json({ data: results, count: results.length });
    }

    if (action === "rename") {
      const { id, name } = body;
      if (!id || !name) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

      const { data, error } = await sb
        .from("vize_gorselleri_uploads")
        .update({ gorsel_adi: name.trim() })
        .eq("id", id)
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

      const { data: row } = await sb
        .from("vize_gorselleri_uploads")
        .select("gorsel_url")
        .eq("id", id)
        .single();

      if (row?.gorsel_url) {
        const url = row.gorsel_url as string;
        const pathMatch = url.match(/\/uploads\/(.+)$/);
        if (pathMatch) {
          await sb.storage.from("uploads").remove([pathMatch[1]]);
        }
      }

      const { error } = await sb.from("vize_gorselleri_uploads").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "next_sira") {
      const { data: existing } = await sb
        .from("vize_gorselleri_uploads")
        .select("sira_no")
        .eq("user_id", user.id)
        .order("sira_no", { ascending: false })
        .limit(1);

      return NextResponse.json({ nextNo: (existing?.[0]?.sira_no || 0) + 1 });
    }

    return NextResponse.json({ error: "Geçersiz action: " + action }, { status: 400 });
  } catch (err: any) {
    console.error("[POST catch]", err?.message, err?.stack);
    return NextResponse.json({ error: "Sunucu hatası: " + (err?.message || "bilinmeyen") }, { status: 500 });
  }
}
