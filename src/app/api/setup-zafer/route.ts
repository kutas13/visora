import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: string[] = [];

  // Check if Zafer already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("name", "ZAFER")
    .maybeSingle();

  if (existing) {
    results.push(`ZAFER already exists with id: ${existing.id}`);
    return NextResponse.json({ results });
  }

  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: "zafer@foxturizm.com",
    password: "001020",
    email_confirm: true,
  });

  if (authError) {
    results.push(`Auth creation error: ${authError.message}`);
    return NextResponse.json({ results, error: authError.message }, { status: 500 });
  }

  results.push(`Auth user created: ${authUser.user.id}`);

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    name: "ZAFER",
    role: "staff",
  });

  if (profileError) {
    results.push(`Profile creation error: ${profileError.message}`);
    return NextResponse.json({ results, error: profileError.message }, { status: 500 });
  }

  results.push("ZAFER profile created successfully");

  return NextResponse.json({ results });
}
