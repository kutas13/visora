import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: dakikada max 15 sorgu
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`passport:${clientIp}`, 15, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla sorgu. Biraz bekleyin." }, { status: 429 });
    }

    const body = await request.json();
    const passportNo = body?.passportNo;

    if (!passportNo || typeof passportNo !== "string" || passportNo.trim().length < 2) {
      return NextResponse.json(
        { error: "Geçerli bir pasaport numarası girin." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("Pasaport sorgu: SUPABASE_SERVICE_ROLE_KEY veya URL eksik");
      return NextResponse.json(
        { error: "Sunucu yapılandırması eksik." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Once tam eslestirme dene, yoksa ilike ile
    const { data, error } = await supabase
      .from("visa_files")
      .select("*")
      .ilike("pasaport_no", passportNo.trim());

    if (error) {
      console.error("Pasaport sorgu hatası:", error.message, error.details);
      return NextResponse.json(
        { error: `Sorgulama hatası: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("Passport query error:", err);
    return NextResponse.json(
      { error: "Sunucu hatası." },
      { status: 500 }
    );
  }
}
