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

async function ensureTable() {
  const sb = adminClient();
  try {
    await sb.rpc("exec_sql", {
      query: `
        CREATE TABLE IF NOT EXISTS vize_gorselleri_uploads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          gorsel_url TEXT NOT NULL,
          gorsel_adi TEXT NOT NULL,
          sira_no INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `,
    });
  } catch {}
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    let query = supabase
      .from("vize_gorselleri_uploads")
      .select("*, profiles:user_id(name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01") {
        await ensureTable();
        return NextResponse.json({ data: [] });
      }
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const action = formData.get("action") as string;

    if (action === "upload") {
      const files = formData.getAll("files") as File[];
      if (!files.length) return NextResponse.json({ error: "Dosya seçilmedi" }, { status: 400 });

      const sb = adminClient();

      const { data: existing } = await supabase
        .from("vize_gorselleri_uploads")
        .select("sira_no")
        .eq("user_id", user.id)
        .order("sira_no", { ascending: false })
        .limit(1);

      let nextNo = (existing?.[0]?.sira_no || 0) + 1;
      const results: any[] = [];

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath = `vize-gorselleri/${user.id}/${Date.now()}-${nextNo}.${ext}`;

        const { error: uploadErr } = await sb.storage
          .from("uploads")
          .upload(storagePath, Buffer.from(bytes), {
            contentType: file.type,
            upsert: true,
          });

        if (uploadErr) {
          console.error("[Upload error]", uploadErr.message);
          continue;
        }

        const { data: urlData } = sb.storage.from("uploads").getPublicUrl(storagePath);
        const gorselUrl = urlData.publicUrl;
        const gorselAdi = String(nextNo);

        const { data: row, error: insertErr } = await supabase
          .from("vize_gorselleri_uploads")
          .insert({ user_id: user.id, gorsel_url: gorselUrl, gorsel_adi: gorselAdi, sira_no: nextNo })
          .select("*")
          .single();

        if (insertErr) {
          if (insertErr.code === "42P01") {
            await ensureTable();
            const { data: row2 } = await supabase
              .from("vize_gorselleri_uploads")
              .insert({ user_id: user.id, gorsel_url: gorselUrl, gorsel_adi: gorselAdi, sira_no: nextNo })
              .select("*")
              .single();
            if (row2) results.push(row2);
          } else {
            console.error("[Insert error]", insertErr.message);
          }
        } else if (row) {
          results.push(row);
        }

        nextNo++;
      }

      return NextResponse.json({ data: results });
    }

    if (action === "rename") {
      const id = formData.get("id") as string;
      const newName = formData.get("name") as string;
      if (!id || !newName) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

      const { data, error } = await supabase
        .from("vize_gorselleri_uploads")
        .update({ gorsel_adi: newName.trim() })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "delete") {
      const id = formData.get("id") as string;
      if (!id) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

      const { data: row } = await supabase
        .from("vize_gorselleri_uploads")
        .select("gorsel_url")
        .eq("id", id)
        .single();

      if (row?.gorsel_url) {
        const url = row.gorsel_url as string;
        const pathMatch = url.match(/\/uploads\/(.+)$/);
        if (pathMatch) {
          const sb = adminClient();
          await sb.storage.from("uploads").remove([pathMatch[1]]);
        }
      }

      const { error } = await supabase
        .from("vize_gorselleri_uploads")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
