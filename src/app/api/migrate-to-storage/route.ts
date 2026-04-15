import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "uploads";

async function uploadBase64(
  supabase: any,
  dataUrl: string,
  folder: string,
  name: string
): Promise<string | null> {
  if (!dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;

  const mimetype = match[1];
  const base64 = match[2];
  const ext = mimetype.split("/")[1]?.replace("jpeg", "jpg") || "bin";
  const path = `${folder}/${name}.${ext}`;

  const buffer = Buffer.from(base64, "base64");
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimetype, upsert: true });

  if (error) {
    console.error(`Upload error for ${path}:`, error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.id === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 52428800,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
      });
    }

    const stats = { randevu_gorseller: 0, randevu_dosyalari: 0, vize_gorseli: 0, errors: 0 };

    // 1) randevu_talepleri.gorseller
    const { data: randevular } = await supabase
      .from("randevu_talepleri")
      .select("id, gorseller, randevu_dosyalari");

    if (randevular) {
      for (const r of randevular) {
        let updated = false;
        const newGorseller: string[] = [];
        for (let i = 0; i < (r.gorseller?.length || 0); i++) {
          const g = r.gorseller[i];
          if (g.startsWith("data:")) {
            const url = await uploadBase64(supabase, g, "randevu-pasaport", `${r.id}-g${i}-${Date.now()}`);
            if (url) { newGorseller.push(url); stats.randevu_gorseller++; updated = true; }
            else { newGorseller.push(g); stats.errors++; }
          } else {
            newGorseller.push(g);
          }
        }

        const newDosyalar: string[] = [];
        for (let i = 0; i < (r.randevu_dosyalari?.length || 0); i++) {
          const d = r.randevu_dosyalari[i];
          if (d.startsWith("data:")) {
            const url = await uploadBase64(supabase, d, "randevu-mektubu", `${r.id}-d${i}-${Date.now()}`);
            if (url) { newDosyalar.push(url); stats.randevu_dosyalari++; updated = true; }
            else { newDosyalar.push(d); stats.errors++; }
          } else {
            newDosyalar.push(d);
          }
        }

        if (updated) {
          await supabase.from("randevu_talepleri").update({
            gorseller: newGorseller,
            randevu_dosyalari: newDosyalar,
          }).eq("id", r.id);
        }
      }
    }

    // 2) visa_files.vize_gorseli
    const { data: visaFiles } = await supabase
      .from("visa_files")
      .select("id, vize_gorseli")
      .not("vize_gorseli", "is", null);

    if (visaFiles) {
      for (const vf of visaFiles) {
        if (vf.vize_gorseli && vf.vize_gorseli.startsWith("data:")) {
          const url = await uploadBase64(supabase, vf.vize_gorseli, "vize-gorseli", `${vf.id}-${Date.now()}`);
          if (url) {
            await supabase.from("visa_files").update({ vize_gorseli: url }).eq("id", vf.id);
            stats.vize_gorseli++;
          } else {
            stats.errors++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration tamamlandı",
      stats,
    });
  } catch (err: any) {
    console.error("[migrate-to-storage] Hata:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
