"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card } from "@/components/ui";

const USER_AVATARS: Record<string, string> = {
  DAVUT: "/davut-avatar.png",
  BAHAR: "/bahar-avatar.jpg",
  ERCAN: "/ercan-avatar.jpg",
  YUSUF: "/yusuf-avatar.png",
  SIRRI: "/sirri-avatar.png",
};

const CONTACT_LIST = [
  { value: "905435680874", label: "Davut Bey", name: "DAVUT" },
  { value: "905055623279", label: "Bahar Hanım", name: "BAHAR" },
  { value: "905055623301", label: "Ercan Bey", name: "ERCAN" },
  { value: "905058937071", label: "Yusuf Bey", name: "YUSUF" },
  { value: "905055623170", label: "Fehmi Bey", name: "FEHMİ" },
  { value: "905078015033", label: "Sırrı Bey", name: "SIRRI" },
  { value: "all", label: "Tüm Ekip", name: "Hepsi" },
];

type ReminderType = "randevu" | "randevu_yarin" | "vize_bitis" | "vize_bitis_customers";

export default function AdminWhatsAppPage() {
  const [sending, setSending] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "status-check", message: "ping" }),
        });
        const data = await res.json();
        setConnectionStatus(data.hint || res.status === 503 ? "disconnected" : "connected");
      } catch {
        setConnectionStatus("disconnected");
      }
    };
    checkStatus();
  }, []);

  const sendReminder = async (type: ReminderType) => {
    setSending(true);
    setActiveAction(type);
    setResult({ type: "info", message: "Hazırlanıyor..." });

    try {
      const recipients = selectedRecipient === "all"
        ? CONTACT_LIST.filter(c => c.value !== "all").map(c => c.value)
        : [selectedRecipient];

      const res = await fetch("/api/whatsapp/auto-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipients }),
      });

      const data = await res.json().catch(() => ({ error: "Yanıt okunamadı" }));

      if (res.ok) {
        const labels: Record<string, string> = {
          randevu: "Randevu hatırlatması",
          randevu_yarin: "Yarınki randevu bildirimi",
          vize_bitis: "Vize bitiş hatırlatması",
          vize_bitis_customers: "Müşteri vize bitiş mesajları",
        };
        const countInfo = type === "vize_bitis_customers"
          ? `${data.sentTo}/${data.count} müşteriye gönderildi`
          : `${data.count} kayıt bildirildi`;
        setResult({ type: "success", message: `${labels[type]} basariyla gonderildi. ${countInfo}` });
      } else {
        setResult({ type: "error", message: data.error || "Gönderilemedi" });
      }
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Bağlantı hatası" });
    } finally {
      setSending(false);
      setActiveAction(null);
    }
  };

  const reminderActions = [
    {
      id: "randevu",
      title: "Randevu Hatırlatması",
      subtitle: "Gelecek 3 günün randevuları",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: "blue",
      type: "randevu" as ReminderType,
    },
    {
      id: "randevu_yarin",
      title: "Sadece Yarın",
      subtitle: "Yarınki randevular",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "indigo",
      type: "randevu_yarin" as ReminderType,
    },
    {
      id: "vize_bitis",
      title: "Vize Bitiş (Personel)",
      subtitle: "30 gün içinde bitenler",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: "amber",
      type: "vize_bitis" as ReminderType,
    },
    {
      id: "vize_bitis_customers",
      title: "Müşteri Bildirimi",
      subtitle: "60 gün kala direkt müşteriye",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: "emerald",
      type: "vize_bitis_customers" as ReminderType,
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; icon: string; hover: string; activeBg: string }> = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "bg-blue-100 text-blue-600", hover: "hover:border-blue-400", activeBg: "bg-blue-600" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", icon: "bg-indigo-100 text-indigo-600", hover: "hover:border-indigo-400", activeBg: "bg-indigo-600" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "bg-amber-100 text-amber-600", hover: "hover:border-amber-400", activeBg: "bg-amber-600" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "bg-emerald-100 text-emerald-600", hover: "hover:border-emerald-400", activeBg: "bg-emerald-600" },
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">WhatsApp Bildirimleri</h1>
          <p className="text-navy-500 text-sm mt-1">Otomatik hatırlatma mesajları gönderin</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connectionStatus === "connected" ? "bg-green-500" :
            connectionStatus === "disconnected" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
          }`} />
          <span className="text-sm text-navy-600">
            {connectionStatus === "connected" ? "Bağlı" :
             connectionStatus === "disconnected" ? "Bağlantı yok" : "Kontrol ediliyor"}
          </span>
        </div>
      </div>

      {/* Alıcı Seçimi */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wide mb-3">Bildirim Alıcısı</h3>
        <div className="flex flex-wrap gap-2">
          {CONTACT_LIST.map((contact) => {
            const avatarSrc = USER_AVATARS[contact.name];
            const isSelected = selectedRecipient === contact.value;
            return (
              <button
                key={contact.value}
                onClick={() => setSelectedRecipient(contact.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-navy-900 text-white shadow-md"
                    : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                }`}
              >
                {avatarSrc ? (
                  <div className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ${isSelected ? "ring-1 ring-white/50" : "ring-1 ring-navy-200"}`}>
                    <Image src={avatarSrc} alt={contact.label} width={24} height={24} className="w-full h-full object-cover" />
                  </div>
                ) : contact.value !== "all" ? (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${isSelected ? "bg-white/20 text-white" : "bg-navy-200 text-navy-600"}`}>
                    {contact.label.charAt(0)}
                  </div>
                ) : null}
                {contact.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Hatırlatma Aksiyonları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reminderActions.map((action) => {
          const colors = colorMap[action.color];
          const isActive = activeAction === action.id;
          return (
            <Card
              key={action.id}
              className={`p-5 border ${colors.border} ${colors.bg} ${colors.hover} transition-all ${isActive ? "ring-2 ring-offset-1" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold ${colors.text}`}>{action.title}</h4>
                  <p className="text-sm text-navy-500 mt-0.5">{action.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => sendReminder(action.type)}
                disabled={sending || connectionStatus === "disconnected"}
                className={`w-full mt-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colors.activeBg} hover:opacity-90`}
              >
                {isActive ? "Gönderiliyor..." : "Gönder"}
              </button>
            </Card>
          );
        })}
      </div>

      {/* Sonuç */}
      {result && (
        <Card className={`p-4 border ${
          result.type === "success" ? "bg-green-50 border-green-200" :
          result.type === "error" ? "bg-red-50 border-red-200" :
          "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">
              {result.type === "success" ? "✓" : result.type === "error" ? "✕" : "→"}
            </span>
            <p className={`text-sm ${
              result.type === "success" ? "text-green-700" :
              result.type === "error" ? "text-red-700" : "text-blue-700"
            }`}>
              {result.message}
            </p>
          </div>
        </Card>
      )}

      {/* Bilgi */}
      <Card className="p-4 bg-navy-50 border border-navy-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-navy-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-navy-600 space-y-1">
            <p>Randevu hatırlatmaları seçilen kişilere toplu bilgi mesajı gönderir.</p>
            <p>Müşteri bildirimi, telefon numarası kayıtlı ve 60 gün içinde vizesi dolacak müşterilere doğrudan gider. Aynı müşteriye 5 gün içinde tekrar mesaj gönderilmez.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
