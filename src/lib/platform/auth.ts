import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PlatformOwnerCtx = {
  /** Service role admin client. Yalnizca auth.admin.createUser gibi yerlerde KULLAN. */
  admin: SupabaseClient | null;
  /** Caller'in kendi session'i. RLS ile platform_owner haklarinda calisir. */
  userClient: ServerSupabase;
  userId: string;
};

/**
 * Visora platform owner için kapsayıcı yetki kontrolü.
 *
 * - Auth gerekli; profiles.role = 'platform_owner' olmalı.
 * - userClient: RLS uyumlu (insert/update/select için bunu kullan; is_platform_owner() true döner).
 * - admin: yalnızca auth admin API (createUser/deleteUser) için. Service role key yoksa null döner.
 */
export async function requirePlatformOwner(): Promise<
  | { ok: true; ctx: PlatformOwnerCtx }
  | { ok: false; response: NextResponse }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Giriş gerekli." }, { status: 401 }) };
  }

  const { data: profile, error: profErr } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profErr || profile?.role !== "platform_owner") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Yalnızca Visora platform sahibi yapabilir." }, { status: 403 }),
    };
  }

  const admin =
    supabaseUrl && serviceKey && isLikelyServiceRoleKey(serviceKey)
      ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;

  return { ok: true, ctx: { admin, userClient, userId: user.id } };
}

/**
 * JWT payload'ında "role":"service_role" var mı? (Yanlışlıkla anon key konulduysa false döner.)
 * Hatalı format ise true döner — gerçek hata Supabase'ten gelir.
 */
function isLikelyServiceRoleKey(key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== 3) return true;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    );
    return payload?.role === "service_role";
  } catch {
    return true;
  }
}

export const SERVICE_KEY_SETUP_HINT =
  "SUPABASE_SERVICE_ROLE_KEY tanımlı değil veya yanlış (anon key olabilir). " +
  "Supabase Dashboard > Project Settings > API > 'service_role' anahtarını " +
  "Vercel ve .env.local içindeki SUPABASE_SERVICE_ROLE_KEY değerine yapıştırın, sonra yeniden deploy edin.";

/** Auth Admin API hatasını anlaşılır metne çevir. */
export function explainAuthAdminError(message: string): string {
  if (/user not allowed/i.test(message)) {
    return "Supabase 'User not allowed' döndü. " + SERVICE_KEY_SETUP_HINT;
  }
  return message;
}
