// Bildirim yardimci fonksiyonlari
import { createClient } from "@/lib/supabase/client";

/**
 * Tek-firma kalintisi olan ADMIN_UUID kaldirildi. Cok-firma modelde her
 * sirketin kendi Genel Muduru (admin) farkli bir UUID. Belirli bir
 * kullanicinin bagli oldugu Genel Muduru runtime'da cozer ve bildirimi
 * o kullaniciya yazariz. Eski "ADMIN_UUID" sabitiyle yapilan disaridan
 * referanslar bozulmasin diye bos string export edilir (deprecated).
 *
 * @deprecated Use `getOrgAdminUserId()` instead.
 */
export const ADMIN_UUID = "";

/**
 * Verilen kullanicinin bagli oldugu sirketteki Genel Muduru (role='admin')
 * bulup id'sini doner. Bulunamazsa null doner; bu durumda admin bildirimi
 * yazilmaz (auth akisini kirmaz).
 */
async function getOrgAdminUserId(actorId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: actor } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", actorId)
      .maybeSingle();
    const orgId = (actor as { organization_id?: string | null } | null)?.organization_id;
    if (!orgId) return null;
    const { data: admin } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    return (admin as { id?: string } | null)?.id || null;
  } catch (e) {
    console.error("getOrgAdminUserId hata:", e);
    return null;
  }
}

interface NotificationData {
  user_id: string;
  file_id?: string;
  kind: string;
  title: string;
  body: string;
  unique_key?: string;
}

// Bildirim oluştur
export async function createNotification(data: NotificationData) {
  const supabase = createClient();
  
  try {
    const { error } = await supabase.from("notifications").insert({
      ...data,
      is_read: false,
      sent_at: new Date().toISOString(),
    });
    
    if (error && !error.message.includes("duplicate")) {
      console.error("Bildirim oluşturma hatası:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Bildirim exception:", e);
    return false;
  }
}

// Dosya oluşturuldu bildirimi
export async function notifyFileCreated(
  fileId: string,
  musteriAd: string,
  hedefUlke: string,
  creatorId: string,
  creatorName: string
) {
  const timestamp = Date.now();

  // Oluşturan kişiye bildirim
  await createNotification({
    user_id: creatorId,
    file_id: fileId,
    kind: "file_created",
    title: "Dosya Oluşturdunuz",
    body: `${musteriAd} (${hedefUlke}) dosyasını oluşturdunuz.`,
    unique_key: `file:${fileId}:created:${creatorId}:${timestamp}`,
  });

  // Sirket Genel Muduru'na (admin) bildirim
  const adminId = await getOrgAdminUserId(creatorId);
  if (adminId && adminId !== creatorId) {
    await createNotification({
      user_id: adminId,
      file_id: fileId,
      kind: "file_created",
      title: "Yeni Dosya Oluşturuldu",
      body: `${creatorName} ${hedefUlke} dosyası oluşturdu. Müşteri: ${musteriAd}`,
      unique_key: `file:${fileId}:created:admin:${timestamp}`,
    });
  }
}

// Dosya güncellendi bildirimi
export async function notifyFileUpdated(
  fileId: string,
  musteriAd: string,
  updaterId: string,
  updaterName: string,
  updateMessage: string
) {
  const timestamp = Date.now();

  // Güncelleyen kişiye bildirim
  await createNotification({
    user_id: updaterId,
    file_id: fileId,
    kind: "file_updated",
    title: "Dosya Güncellendi",
    body: `${musteriAd} dosyasını güncellediniz.`,
    unique_key: `file:${fileId}:updated:${updaterId}:${timestamp}`,
  });

  const adminId = await getOrgAdminUserId(updaterId);
  if (adminId && adminId !== updaterId) {
    await createNotification({
      user_id: adminId,
      file_id: fileId,
      kind: "file_updated",
      title: "Dosya Güncellendi",
      body: `${updaterName}: ${updateMessage}`,
      unique_key: `file:${fileId}:updated:admin:${timestamp}`,
    });
  }
}

// Dosya durumu değişti bildirimi
export async function notifyFileStatusChanged(
  fileId: string,
  musteriAd: string,
  actorId: string,
  actorName: string,
  statusTitle: string,
  statusMessage: string
) {
  const timestamp = Date.now();

  // İşlemi yapan kişiye bildirim
  await createNotification({
    user_id: actorId,
    file_id: fileId,
    kind: "status_change",
    title: statusTitle,
    body: `${musteriAd}: ${statusMessage}`,
    unique_key: `file:${fileId}:status:${actorId}:${timestamp}`,
  });

  const adminId = await getOrgAdminUserId(actorId);
  if (adminId && adminId !== actorId) {
    await createNotification({
      user_id: adminId,
      file_id: fileId,
      kind: "status_change",
      title: statusTitle,
      body: `${actorName} - ${musteriAd}: ${statusMessage}`,
      unique_key: `file:${fileId}:status:admin:${timestamp}`,
    });
  }
}

// Dosya transfer bildirimi
export async function notifyFileTransferred(
  fileId: string,
  musteriAd: string,
  hedefUlke: string,
  oldOwnerId: string,
  newOwnerId: string,
  newOwnerName: string,
  transferredBy: string,
  transferredByName: string
) {
  const timestamp = Date.now();

  // Transfer yapan kişiye (admin) bildirim
  await createNotification({
    user_id: transferredBy,
    file_id: fileId,
    kind: "transfer",
    title: "Dosya Atandı",
    body: `${musteriAd} dosyasını ${newOwnerName} personeline atadınız.`,
    unique_key: `file:${fileId}:transfer:by:${timestamp}`,
  });

  // Eski sahibine bildirim (eğer varsa ve farklıysa)
  if (oldOwnerId && oldOwnerId !== newOwnerId) {
    await createNotification({
      user_id: oldOwnerId,
      file_id: fileId,
      kind: "transfer",
      title: "Dosya Alındı",
      body: `${musteriAd} (${hedefUlke}) dosyası sizden alındı ve ${newOwnerName} personeline atandı.`,
      unique_key: `file:${fileId}:transfer:from:${timestamp}`,
    });
  }

  // Yeni sahibine bildirim
  await createNotification({
    user_id: newOwnerId,
    file_id: fileId,
    kind: "transfer",
    title: "Yeni Dosya Atandı",
    body: `${transferredByName} size ${musteriAd} (${hedefUlke}) dosyasını atadı.`,
    unique_key: `file:${fileId}:transfer:to:${timestamp}`,
  });
}

// Ödeme alındı bildirimi
export async function notifyPaymentReceived(
  fileId: string,
  musteriAd: string,
  amount: number,
  method: string,
  collectorId: string,
  collectorName: string
) {
  const timestamp = Date.now();
  const formattedAmount = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
  const methodText = method === "nakit" ? "Nakit" : method === "pos" ? "POS" : method === "hesaba" ? "Hesaba" : "Cari";

  // Tahsilat yapan kişiye
  await createNotification({
    user_id: collectorId,
    file_id: fileId,
    kind: "payment",
    title: "Ödeme Alındı",
    body: `${musteriAd} için ${formattedAmount} (${methodText}) tahsilat yaptınız.`,
    unique_key: `file:${fileId}:payment:${collectorId}:${timestamp}`,
  });

  const adminId = await getOrgAdminUserId(collectorId);
  if (adminId && adminId !== collectorId) {
    await createNotification({
      user_id: adminId,
      file_id: fileId,
      kind: "payment",
      title: "Yeni Tahsilat",
      body: `${collectorName} - ${musteriAd}: ${formattedAmount} (${methodText})`,
      unique_key: `file:${fileId}:payment:admin:${timestamp}`,
    });
  }
}
