// Bildirim yardımcı fonksiyonları
import { createClient } from "@/lib/supabase/client";

// Admin DAVUT'un UUID'si
export const ADMIN_UUID = "d81c3235-d082-4563-a9b5-7c511cfbb8a5";

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

  // Admin'e bildirim (eğer oluşturan admin değilse)
  if (creatorId !== ADMIN_UUID) {
    await createNotification({
      user_id: ADMIN_UUID,
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

  // Admin'e bildirim
  if (updaterId !== ADMIN_UUID) {
    await createNotification({
      user_id: ADMIN_UUID,
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

  // Admin'e bildirim
  if (actorId !== ADMIN_UUID) {
    await createNotification({
      user_id: ADMIN_UUID,
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

  // Admin'e bildirim
  if (collectorId !== ADMIN_UUID) {
    await createNotification({
      user_id: ADMIN_UUID,
      file_id: fileId,
      kind: "payment",
      title: "Yeni Tahsilat",
      body: `${collectorName} - ${musteriAd}: ${formattedAmount} (${methodText})`,
      unique_key: `file:${fileId}:payment:admin:${timestamp}`,
    });
  }
}
