import { createClient } from "./client";

const BUCKET = "uploads";

/**
 * Upload a base64 data URL to Supabase Storage and return the public URL.
 * Falls back to returning the original string if upload fails.
 */
export async function uploadBase64ToStorage(
  dataUrl: string,
  folder: string,
  fileName?: string
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;

  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return dataUrl;

  const mimetype = match[1];
  const base64 = match[2];
  const ext = mimetype.split("/")[1]?.replace("jpeg", "jpg") || "bin";
  const name = fileName || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${folder}/${name}.${ext}`;

  const supabase = createClient();

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimetype });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimetype, upsert: true });

  if (error) {
    console.error("[Storage upload error]", error.message);
    return dataUrl;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/**
 * Upload multiple base64 data URLs in parallel.
 */
export async function uploadMultipleToStorage(
  dataUrls: string[],
  folder: string
): Promise<string[]> {
  return Promise.all(
    dataUrls.map((url, i) => uploadBase64ToStorage(url, folder, `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`))
  );
}

/**
 * Check if a string is a storage URL (not base64).
 */
export function isStorageUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}
