import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const INTERVAL_MS = 5 * 60 * 1000; // 5 dakika

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ lastCheckTime: Date.now(), interval: INTERVAL_MS });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // idata_last_check tablosundan son check zamanını al
    const { data } = await supabase
      .from("idata_last_check")
      .select("checked_at")
      .order("checked_at", { ascending: false })
      .limit(1);

    const lastCheckTime = data?.[0]?.checked_at
      ? new Date(data[0].checked_at).getTime()
      : Date.now() - INTERVAL_MS; // Hiç check yapılmadıysa hemen kontrol et

    return NextResponse.json({
      lastCheckTime,
      currentTime: Date.now(),
      interval: INTERVAL_MS,
    });
  } catch {
    return NextResponse.json({ lastCheckTime: Date.now(), interval: INTERVAL_MS });
  }
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Yeni check zamanı kaydet
    await supabase.from("idata_last_check").insert({ checked_at: new Date().toISOString() });

    // Eski kayıtları temizle (son 10 tane tut)
    const { data: old } = await supabase
      .from("idata_last_check")
      .select("id")
      .order("checked_at", { ascending: false })
      .range(10, 1000);

    if (old && old.length > 0) {
      await supabase.from("idata_last_check").delete().in("id", old.map(o => o.id));
    }

    return NextResponse.json({ success: true, lastCheckTime: Date.now() });
  } catch {
    return NextResponse.json({ success: false });
  }
}