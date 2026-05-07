import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const BUCKET = "passport-images";

export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const base64: string | undefined = body?.base64;
    const fileId: string | undefined = body?.fileId; // mevcut dosya güncellemesi
    const passportNo: string | undefined = body?.passportNo;

    if (!base64) {
      return NextResponse.json({ error: "base64 gerekli" }, { status: 400 });
    }

    const m = base64.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
    if (!m) {
      return NextResponse.json(
        { error: "Geçersiz görsel formatı (PNG / JPG / WEBP olmalı)." },
        { status: 400 }
      );
    }
    const mimeType = m[1];
    const ext = m[2] === "jpeg" ? "jpg" : m[2];
    const data = Buffer.from(m[3], "base64");

    if (data.length > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Pasaport görseli 8MB'tan büyük olamaz." },
        { status: 400 }
      );
    }

    // Bucket yoksa oluştur
    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const safePassport = (passportNo || "tmp")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 20);
    const fileName = `${user.id}/${safePassport}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(fileName, data, {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(fileName);
    const url = publicData.publicUrl;

    // Eğer mevcut dosya varsa, image url'ini visa_files'a yaz
    if (fileId) {
      await admin
        .from("visa_files")
        .update({ pasaport_image_url: url })
        .eq("id", fileId);
    }

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error("[passport-image/upload] fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Yükleme sırasında hata oluştu." },
      { status: 500 }
    );
  }
}
