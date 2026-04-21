import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const sb = adminClient();
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
      return NextResponse.json({ data: [] });
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
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sb = adminClient();
    const body = await req.json();
    const { action } = body;

    if (action === "save") {
      const { items } = body as { items: { gorsel_url: string; gorsel_adi: string; sira_no: number }[] };
      if (!items || !items.length) return NextResponse.json({ error: "Eksik veri" }, { status: 400 });

      const results: any[] = [];
      for (const item of items) {
        const { data: row, error: insertErr } = await sb
          .from("vize_gorselleri_uploads")
          .insert({ user_id: user.id, gorsel_url: item.gorsel_url, gorsel_adi: item.gorsel_adi, sira_no: item.sira_no })
          .select("*")
          .single();

        if (insertErr) {
          console.error("[DB insert error]", insertErr.message);
        } else if (row) {
          results.push(row);
        }
      }
      return NextResponse.json({ data: results, count: results.length });
    }

    if (action === "upload_single") {
      const { base64, fileName, contentType, siraNo } = body as { base64: string; fileName: string; contentType: string; siraNo: number };
      if (!base64 || !fileName) return NextResponse.json({ error: "Eksik veri" }, { status: 400 });

      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const bytes = Buffer.from(base64Data, "base64");
      const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `vize-gorselleri/${user.id}/${Date.now()}-${siraNo}.${ext}`;

      const { error: uploadErr } = await sb.storage
        .from("uploads")
        .upload(storagePath, bytes, { contentType: contentType || "image/jpeg", upsert: true });

      if (uploadErr) {
        console.error("[Storage upload error]", uploadErr.message);
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
      }

      const { data: urlData } = sb.storage.from("uploads").getPublicUrl(storagePath);
      const gorselUrl = urlData.publicUrl;
      const gorselAdi = String(siraNo);

      const { data: row, error: insertErr } = await sb
        .from("vize_gorselleri_uploads")
        .insert({ user_id: user.id, gorsel_url: gorselUrl, gorsel_adi: gorselAdi, sira_no: siraNo })
        .select("*")
        .single();

      if (insertErr) {
        console.error("[DB insert error]", insertErr.message);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({ data: row });
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

      const { error } = await sb
        .from("vize_gorselleri_uploads")
        .delete()
        .eq("id", id);

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

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST catch]", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
