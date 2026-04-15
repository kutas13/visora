import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.id === "uploads");

    if (!exists) {
      const { error } = await supabase.storage.createBucket("uploads", {
        public: true,
        fileSizeLimit: 52428800,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ message: "Bucket oluşturuldu" });
    }

    return NextResponse.json({ message: "Bucket zaten mevcut" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
