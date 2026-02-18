"use client";

import { useState, useEffect } from "react";
import { Button, Card, Input, Badge, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const CONTACT_LIST = [
  { value: "905435680874", label: "Davut Bey", name: "Davut" },
  { value: "905055623279", label: "Bahar Hanım", name: "Bahar" },
  { value: "905055623301", label: "Ercan Bey", name: "Ercan" },
  { value: "905058937071", label: "Yusuf Bey", name: "Yusuf" },
  { value: "all", label: "🎯 Hepsi", name: "Hepsi" },
];

export default function AdminWhatsAppPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [selectedRecipients, setSelectedRecipients] = useState<string>("905435680874");

  // WhatsApp servis durumunu kontrol et
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "test", message: "test" }),
        });
        const data = await res.json();
        
        if (data.hint || res.status === 503) {
          setConnectionStatus("disconnected");
        } else {
          setConnectionStatus("connected");
        }
      } catch {
        setConnectionStatus("disconnected");
      }
    };
    checkStatus();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !message.trim()) return;

    setSending(true);
    setResult("");

    try {
      // Telefon numarasını WhatsApp formatına çevir (+90 ile başlamalı)
      const whatsappPhone = phoneNumber.startsWith("90") 
        ? "+" + phoneNumber.trim()
        : phoneNumber.startsWith("+") 
          ? phoneNumber.trim()
          : "+90" + phoneNumber.trim();

      console.log(`Admin manuel mesaj gönderiliyor: ${phoneNumber.trim()} → ${whatsappPhone}`);

      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: whatsappPhone,
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(`✅ Mesaj gönderildi! ID: ${data.messageId}`);
        setMessage("");
      } else {
        setResult(`❌ Hata: ${data.error}`);
        if (data.hint) {
          setResult(prev => prev + `\n💡 ${data.hint}`);
        }
      }
    } catch (err) {
      setResult("❌ Bağlantı hatası");
    } finally {
      setSending(false);
    }
  };

  const sendReminderToGroup = async (type: "randevu" | "vize_bitis" | "vize_bitis_customers") => {
    setSending(true);
    setResult(`🔄 ${type === "randevu" ? "Randevu" : type === "vize_bitis_customers" ? "Müşteri vize bitiş" : "Vize bitiş"} hatırlatması hazırlanıyor...`);
    
    try {
      const recipients = selectedRecipients === "all" 
        ? CONTACT_LIST.filter(c => c.value !== "all").map(c => c.value)
        : [selectedRecipients];

      console.log("Admin WhatsApp hatırlatma:", { type, recipients });
      
      const res = await fetch("/api/whatsapp/auto-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipients }),
      });

      const data = await res.json().catch(() => ({ error: "JSON parse hatası" }));
      
      if (res.ok) {
        if (type === "vize_bitis_customers") {
          setResult(`✅ Müşteri vize bitiş mesajları gönderildi! ${data.sentTo}/${data.count} başarılı.`);
        } else {
          const recipientNames = recipients.length > 1 ? "gruba" : CONTACT_LIST.find(c => c.value === recipients[0])?.name || "kişiye";
          setResult(`✅ ${type === "randevu" ? "Randevu" : "Vize bitiş"} hatırlatması ${recipientNames} gönderildi! ${data.count} müşteri bilgisi.`);
        }
      } else {
        setResult(`❌ Hatırlatma hatası (${res.status}): ${data.error || "Bilinmeyen hata"}`);
        if (data.hint) setResult(prev => prev + `\n💡 ${data.hint}`);
        if (data.details) setResult(prev => prev + `\n🔍 Detay: ${JSON.stringify(data.details)}`);
      }
    } catch (err: any) {
      console.error("Admin WhatsApp hatırlatma hatası:", err);
      setResult(`❌ Bağlantı hatası: ${err.message || "API'ye erişilemedi"}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <span className="text-3xl">📱</span>
          WhatsApp Yönetimi (Admin)
        </h1>
        <p className="text-navy-500 mt-1">Tüm personel adına WhatsApp mesajı gönderin</p>
      </div>

      {/* Bağlantı Durumu */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === "connected" ? "bg-green-500" :
            connectionStatus === "disconnected" ? "bg-red-500" : "bg-yellow-500"
          }`} />
          <span className="text-sm font-medium">
            WhatsApp Servis Durumu: {
              connectionStatus === "connected" ? "✅ Bağlı (VPS)" :
              connectionStatus === "disconnected" ? "❌ Bağlı Değil" : "🔄 Kontrol ediliyor..."
            }
          </span>
          {connectionStatus === "disconnected" && (
            <Badge variant="warning" size="sm">VPS servisi kontrol edin</Badge>
          )}
        </div>
      </Card>

      {/* Manuel Mesaj Gönder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">Manuel Mesaj Gönder</h3>
        
        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy-700">Telefon Numarası *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-navy-600 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg">
                  +90
                </span>
                <input
                  type="text"
                  placeholder="5058937071"
                  value={phoneNumber.replace(/^90/, "")}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setPhoneNumber("90" + digits);
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  maxLength={10}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy-700">Hızlı Seçim</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPhoneNumber("905435680874")} className="text-xs p-2 bg-blue-100 hover:bg-blue-200 rounded-lg">📞 Davut</button>
                <button type="button" onClick={() => setPhoneNumber("905055623279")} className="text-xs p-2 bg-blue-100 hover:bg-blue-200 rounded-lg">📞 Bahar</button>
                <button type="button" onClick={() => setPhoneNumber("905055623301")} className="text-xs p-2 bg-blue-100 hover:bg-blue-200 rounded-lg">📞 Ercan</button>
                <button type="button" onClick={() => setPhoneNumber("905058937071")} className="text-xs p-2 bg-blue-100 hover:bg-blue-200 rounded-lg">📞 Yusuf</button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-700 mb-2">Mesaj İçeriği</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="WhatsApp mesajınızı buraya yazın..."
              className="w-full p-3 border border-gray-300 rounded-lg h-32 resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{message.length}/500 karakter</p>
          </div>

          <Button
            type="submit"
            disabled={sending || !phoneNumber.trim() || !message.trim()}
            className="w-full"
          >
            {sending ? "Gönderiliyor..." : "📤 Mesaj Gönder"}
          </Button>
        </form>
      </Card>

      {/* Otomatik Hatırlatmalar (Admin Yetkili) */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">Toplu Hatırlatmalar (Admin)</h3>
        
        {/* Alıcı Seçimi */}
        <div className="mb-6">
          <Select
            label="Hatırlatma Gönderilecek Kişiler"
            options={CONTACT_LIST}
            value={selectedRecipients}
            onChange={(e) => setSelectedRecipients(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📅</span>
              <div>
                <h4 className="font-medium text-navy-900">Randevu Hatırlatması</h4>
                <p className="text-sm text-navy-600">Gelecek 3 günün randevuları</p>
              </div>
            </div>
            <Button
              onClick={() => sendReminderToGroup("randevu")}
              disabled={sending}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              🔔 Randevu Hatırlatması
            </Button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⏰</span>
              <div>
                <h4 className="font-medium text-navy-900">Vize Bitiş (Personel)</h4>
                <p className="text-sm text-navy-600">30 gün içinde bitenler</p>
              </div>
            </div>
            <Button
              onClick={() => sendReminderToGroup("vize_bitis")}
              disabled={sending}
              className="w-full bg-amber-500 hover:bg-amber-600"
            >
              ⚠️ Personele Hatırlatma
            </Button>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📞</span>
              <div>
                <h4 className="font-medium text-navy-900">Müşteri Mesajları</h4>
                <p className="text-sm text-navy-600">Vize bitiş (direkt)</p>
              </div>
            </div>
            <Button
              onClick={() => sendReminderToGroup("vize_bitis_customers")}
              disabled={sending}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              📱 Müşterilere Gönder
            </Button>
          </div>
        </div>
      </Card>

      {/* Sonuç */}
      {result && (
        <Card className="p-4">
          <pre className="text-sm whitespace-pre-wrap text-navy-700">{result}</pre>
        </Card>
      )}

      {/* Hızlı Mesaj Şablonları */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">Admin Mesaj Şablonları</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            "Merhaba, tüm randevularınızı kontrol edin. Eksik evrak varsa derhal tamamlayın.",
            "Önemli duyuru: Vize işlem süreleri değişti. Detaylar için ofise uğrayın.",
            "Bu hafta teslim edilecek pasaportlar hazır. Randevu alarak teslim alabilirsiniz.",
            "Ödeme bekleyen dosyalarınız var. Tahsilat için en kısa sürede iletişime geçin.",
            "Vize bitiş tarihlerinizi kontrol edin. 30 gün içinde yenileme başlatın.",
            "Personel toplantısı: Yarın saat 14:00'te ofiste. Katılım zorunlu.",
          ].map((template, index) => (
            <button
              key={index}
              onClick={() => setMessage(template)}
              className="text-left p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm transition-colors"
            >
              {template}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}