"use client";

import { useState, useEffect } from "react";
import { Modal, Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, ActivityLog, Payment } from "@/lib/supabase/types";

interface FileDetailModalProps {
  fileId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type ActivityLogWithActor = ActivityLog & { profiles?: { name: string } | null };
type PaymentWithCreator = Payment & { profiles?: { name: string } | null };

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", 
    hour: "2-digit", minute: "2-digit"
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

function getStatusBadge(file: VisaFile) {
  if (file.sonuc === "vize_onay") return <Badge variant="success">Vize Onaylandı</Badge>;
  if (file.sonuc === "red") return <Badge variant="error">Reddedildi</Badge>;
  if (file.islemden_cikti) return <Badge variant="purple">İşlemden Çıktı</Badge>;
  if (file.basvuru_yapildi) return <Badge variant="info">Başvuru Yapıldı</Badge>;
  if (file.dosya_hazir) return <Badge variant="info">Dosya Hazır</Badge>;
  if (file.evrak_eksik_mi) return <Badge variant="warning">Evrak Eksik</Badge>;
  return <Badge variant="default">Yeni</Badge>;
}

export default function FileDetailModal({ fileId, isOpen, onClose }: FileDetailModalProps) {
  const [file, setFile] = useState<(VisaFile & { profiles?: { name: string } | null }) | null>(null);
  const [activities, setActivities] = useState<ActivityLogWithActor[]>([]);
  const [payments, setPayments] = useState<PaymentWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fileId || !isOpen) return;

    async function loadData() {
      setLoading(true);
      const supabase = createClient();

      // Dosya bilgileri
      const { data: fileData } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .eq("id", fileId)
        .single();
      setFile(fileData);

      // Aktivite logları
      const { data: logsData } = await supabase
        .from("activity_logs")
        .select("*, profiles:actor_id(name)")
        .eq("file_id", fileId)
        .order("created_at", { ascending: false });
      setActivities(logsData || []);

      // Ödemeler
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*, profiles:created_by(name)")
        .eq("file_id", fileId)
        .order("created_at", { ascending: false });
      setPayments(paymentsData || []);

      setLoading(false);
    }

    loadData();
  }, [fileId, isOpen]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "file_created": return { icon: "📁", bg: "bg-green-100", color: "text-green-600" };
      case "file_updated": return { icon: "✏️", bg: "bg-blue-100", color: "text-blue-600" };
      case "file_ready": return { icon: "✅", bg: "bg-purple-100", color: "text-purple-600" };
      case "application_submitted": return { icon: "📤", bg: "bg-indigo-100", color: "text-indigo-600" };
      case "processing_complete": return { icon: "🔄", bg: "bg-cyan-100", color: "text-cyan-600" };
      case "visa_result": return { icon: "🛂", bg: "bg-yellow-100", color: "text-yellow-600" };
      case "payment_added": return { icon: "💰", bg: "bg-emerald-100", color: "text-emerald-600" };
      case "transfer": return { icon: "🔀", bg: "bg-orange-100", color: "text-orange-600" };
      case "file_archived": return { icon: "📦", bg: "bg-gray-100", color: "text-gray-600" };
      default: return { icon: "📋", bg: "bg-navy-100", color: "text-navy-600" };
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dosya Detayları" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : !file ? (
        <div className="text-center py-8 text-navy-500">Dosya bulunamadı</div>
      ) : (
        <div className="space-y-6">
          {/* Dosya Özeti */}
          <Card className="p-4 bg-gradient-to-r from-navy-50 to-navy-100 border border-navy-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-navy-900">{file.musteri_ad}</h3>
                <p className="text-navy-500">{file.pasaport_no}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="info">{file.hedef_ulke}</Badge>
                  <Badge variant={file.islem_tipi === "randevulu" ? "purple" : "default"}>
                    {file.islem_tipi === "randevulu" ? "Randevulu" : "Randevusuz"}
                  </Badge>
                  {getStatusBadge(file)}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-navy-500">Atanan Personel</p>
                <p className="font-semibold text-navy-900">{file.profiles?.name || "-"}</p>
              </div>
            </div>

            {file.randevu_tarihi && (
              <div className="mt-4 pt-4 border-t border-navy-200">
                <p className="text-sm text-navy-500">Randevu Tarihi</p>
                <p className="font-medium text-navy-900">{formatDateTime(file.randevu_tarihi)}</p>
              </div>
            )}

            {file.vize_bitis_tarihi && (
              <div className="mt-2">
                <p className="text-sm text-navy-500">Vize Bitiş Tarihi</p>
                <p className="font-medium text-navy-900">{new Date(file.vize_bitis_tarihi).toLocaleDateString("tr-TR")}</p>
              </div>
            )}
          </Card>

          {/* Ödemeler */}
          {payments.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-navy-700 uppercase tracking-wide mb-3">
                💰 Ödemeler ({payments.length})
              </h4>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600">₺</span>
                      </div>
                      <div>
                        <p className="font-semibold text-green-700">{formatCurrency(Number(payment.tutar))}</p>
                        <p className="text-xs text-green-600">
                          {payment.profiles?.name} • {payment.yontem === "nakit" ? "Nakit" : "Cari"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-green-500">{formatDateTime(payment.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* İşlem Geçmişi */}
          <div>
            <h4 className="text-sm font-semibold text-navy-700 uppercase tracking-wide mb-3">
              📋 İşlem Geçmişi ({activities.length})
            </h4>
            {activities.length === 0 ? (
              <p className="text-navy-500 text-center py-4">Henüz işlem kaydı yok</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {activities.map((activity) => {
                  const iconStyle = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-navy-50 transition-colors">
                      <div className={`w-10 h-10 ${iconStyle.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className={iconStyle.color}>{iconStyle.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-navy-900">
                          <span className="font-semibold">{activity.profiles?.name || "Sistem"}</span>
                          <span className="text-navy-600 ml-1">{activity.message}</span>
                        </p>
                        <p className="text-xs text-navy-400 mt-1">{formatDateTime(activity.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
