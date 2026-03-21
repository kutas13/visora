import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ message: "Supabase env degiskenleri eksik." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const baseSlug = body.register.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    const agencySlug = `${baseSlug || "agency"}-${Date.now()}`;

    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .insert({ name: body.register.companyName, slug: agencySlug, phone: body.register.phone, plan_type: body.checkout?.planType || "monthly" })
      .select("id")
      .single();

    if (agencyError || !agency) {
      return NextResponse.json({ message: "Agency oluşturulamadı", detail: agencyError?.message }, { status: 500 });
    }

    const userId = crypto.randomUUID();

    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      agency_id: agency.id,
      full_name: body.register.fullName,
      email: body.register.email.toLowerCase().trim(),
      phone: body.register.phone,
      role: "agency_admin",
      password_hash: body.register.password,
    });

    if (userError) {
      return NextResponse.json({ message: "Kullanıcı oluşturulamadı", detail: userError.message }, { status: 500 });
    }

    return NextResponse.json({ agencyId: agency.id, userId, status: "ok" });
  } catch (err: unknown) {
    return NextResponse.json({ message: "Sunucu hatası", detail: err instanceof Error ? err.message : "Bilinmeyen" }, { status: 500 });
  }
}
