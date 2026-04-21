import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const sql = `
      CREATE TABLE IF NOT EXISTS vize_gorselleri_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        gorsel_url TEXT NOT NULL,
        gorsel_adi TEXT NOT NULL,
        sira_no INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'vize_gorselleri_uploads' AND policyname = 'staff_select_own'
        ) THEN
          ALTER TABLE vize_gorselleri_uploads ENABLE ROW LEVEL SECURITY;

          CREATE POLICY "staff_select_own" ON vize_gorselleri_uploads FOR SELECT USING (auth.uid() = user_id);
          CREATE POLICY "staff_insert_own" ON vize_gorselleri_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
          CREATE POLICY "staff_update_own" ON vize_gorselleri_uploads FOR UPDATE USING (auth.uid() = user_id);
          CREATE POLICY "staff_delete_own" ON vize_gorselleri_uploads FOR DELETE USING (auth.uid() = user_id);
          CREATE POLICY "admin_select_all" ON vize_gorselleri_uploads FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
          CREATE POLICY "admin_delete_all" ON vize_gorselleri_uploads FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
          CREATE POLICY "admin_update_all" ON vize_gorselleri_uploads FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
        END IF;
      END $$;
    `;

    const { error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      const { error: err2 } = await supabase.from("vize_gorselleri_uploads").select("id").limit(0);
      if (err2?.code === "42P01") {
        return NextResponse.json(
          { error: "Tablo oluşturulamadı. Supabase Dashboard > SQL Editor'den migration dosyasını çalıştırın.", detail: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ message: "Tablo zaten mevcut" });
    }

    return NextResponse.json({ message: "Tablo başarıyla oluşturuldu" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
