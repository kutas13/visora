import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security";
import { sanitizeSearchToken, turkishSearchVariants } from "@/lib/turkishSearch";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (canlı arama + sorgula; yazdıkça istek artabilir)
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`passport:${clientIp}`, 90, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla sorgu. Biraz bekleyin." }, { status: 429 });
    }

    const body = await request.json();
    const passportNo = body?.passportNo;

    if (!passportNo || typeof passportNo !== "string") {
      return NextResponse.json(
        { error: "Geçerli bir pasaport numarası veya müşteri adı girin." },
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

    const searchTerm = sanitizeSearchToken(passportNo);
    if (searchTerm.length < 2) {
      return NextResponse.json(
        { error: "Geçerli bir pasaport numarası veya müşteri adı girin." },
        { status: 400 }
      );
    }

    const variants = turkishSearchVariants(searchTerm);
    if (variants.length === 0) {
      return NextResponse.json(
        { error: "Geçerli bir pasaport numarası veya müşteri adı girin." },
        { status: 400 }
      );
    }

    const orConditions = variants.flatMap((v) => [
      `pasaport_no.ilike.%${v}%`,
      `musteri_ad.ilike.%${v}%`,
    ]);

    const { data, error } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .or(orConditions.join(","))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Pasaport sorgu hatası:", error.message, error.details);
      return NextResponse.json(
        { error: `Sorgulama hatası: ${error.message}` },
        { status: 500 }
      );
    }

    const rows = [...(data || [])];
    rows.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("Passport query error:", err);
    return NextResponse.json(
      { error: "Sunucu hatası." },
      { status: 500 }
    );
  }
}
