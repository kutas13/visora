import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const admin = getAdmin();

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const base64: string | undefined = body?.base64;
  if (!base64) return NextResponse.json({ error: "base64 gerekli" }, { status: 400 });

  const m = base64.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
  if (!m) {
    return NextResponse.json({ error: "Geçersiz görsel formatı (PNG/JPG/WEBP)." }, { status: 400 });
  }
  const mimeType = m[1];
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  const data = Buffer.from(m[3], "base64");

  if (data.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Foto 5MB'tan büyük olamaz." }, { status: 400 });
  }

  const fileName = `${user.id}-${Date.now()}.${ext}`;

  // Bucket yoksa otomatik oluştur
  await admin.storage.createBucket("avatars", { public: true }).catch(() => {});

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(fileName, data, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from("avatars").getPublicUrl(fileName);
  const url = publicData.publicUrl;

  await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);

  return NextResponse.json({ url });
}
