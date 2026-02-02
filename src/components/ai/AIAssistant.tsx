"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile } from "@/lib/supabase/types";

interface Message {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  files?: FileInfo[];
  staffStats?: StaffStats[];
  timestamp: Date;
}

interface FileInfo {
  id: string;
  musteri_ad: string;
  hedef_ulke: string;
  durum: string;
  randevu_tarihi?: string;
  odeme_durumu: string;
  staff_name?: string;
  ucret?: number;
  ucret_currency?: string;
}

interface StaffStats {
  id: string;
  name: string;
  totalFiles: number;
  activeFiles: number;
  completedFiles: number;
  approvedFiles: number;
  rejectedFiles: number;
  unpaidFiles: number;
  upcomingAppointments: number;
  todayAppointments: number;
  missingDocs: number;
  successRate: number;
}

interface GeneralStats {
  totalFiles: number;
  activeFiles: number;
  todayAppointments: number;
  weekAppointments: number;
  unpaidFiles: number;
  missingDocsFiles: number;
  approvedFiles: number;
  rejectedFiles: number;
  inProgressFiles: number;
  readyFiles: number;
  totalRevenueTL: number;
  totalRevenueEUR: number;
  totalRevenueUSD: number;
}

// Turkish character normalization
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/[?!.,;:'"]/g, '')
    .trim();
};

// Keyword patterns for better matching
const KEYWORDS = {
  // Payment related
  payment: ['odeme', 'odenmemis', 'odenmedi', 'tahsilat', 'para', 'ucret', 'fiyat', 'tutar', 'borc', 'alacak', 'cari', 'pesin', 'nakit', 'kasa', 'gelir', 'kazanc', 'ciro', 'hasilat'],
  
  // Appointment related  
  appointment: ['randevu', 'tarih', 'gun', 'saat', 'takvim', 'planlama', 'konsolosluk', 'elcilik', 'basvuru'],
  
  // Document related
  document: ['evrak', 'belge', 'dokuman', 'eksik', 'tamam', 'hazir', 'pasaport', 'fotograf', 'sigorta', 'otel', 'ucak', 'bilet', 'rezervasyon'],
  
  // Status related
  status: ['durum', 'ne oldu', 'ne durumda', 'nasil', 'nerede', 'hangi', 'asama', 'ilerleme', 'sonuc', 'karar'],
  
  // Time related
  time: ['bugun', 'yarin', 'dun', 'hafta', 'ay', 'gun', 'bu hafta', 'gecen hafta', 'bu ay', 'gecen ay', 'son', 'yakin', 'acil', 'yakinda', 'once', 'sonra'],
  
  // Count related
  count: ['kac', 'kac tane', 'sayisi', 'adet', 'toplam', 'ne kadar', 'miktar'],
  
  // Comparison related
  compare: ['en cok', 'en az', 'en fazla', 'en iyi', 'en kotu', 'karsilastir', 'fark', 'daha', 'siralama', 'siralama'],
  
  // Action related
  action: ['ne yapmaliyim', 'ne yapmam', 'oncelik', 'acil', 'onemli', 'bekleyen', 'yapilacak', 'gorev', 'is', 'takip'],
  
  // Staff related
  staff: ['personel', 'calisan', 'kisi', 'bahar', 'ercan', 'yusuf', 'kim', 'performans', 'verimlilik'],
  
  // File related
  file: ['dosya', 'vize', 'basvuru', 'kayit', 'islem', 'musteri', 'muvekil'],
  
  // Statistics related
  stats: ['istatistik', 'rapor', 'ozet', 'analiz', 'genel', 'tum', 'butun', 'hepsi'],
  
  // Country related
  countries: ['almanya', 'fransa', 'ingiltere', 'italya', 'ispanya', 'amerika', 'abd', 'kanada', 'avustralya', 'hollanda', 'belcika', 'isvicre', 'avusturya', 'polonya', 'cekya', 'yunanistan', 'bulgaristan', 'japonya', 'cin', 'rusya', 'ukrayna', 'norvec', 'isvec', 'danimarka', 'finlandiya', 'portekiz', 'irlandda', 'schengen'],
  
  // Help related
  help: ['yardim', 'nasil', 'ne sor', 'komut', 'ornek', 'aciklama']
};

// Check if query contains any keyword from a category
const hasKeyword = (query: string, category: keyof typeof KEYWORDS): boolean => {
  const normalized = normalizeText(query);
  return KEYWORDS[category].some(keyword => normalized.includes(keyword));
};

// Fuzzy name matching
const fuzzyMatch = (text: string, target: string, threshold: number = 0.7): boolean => {
  const t = normalizeText(text);
  const ta = normalizeText(target);
  if (t.includes(ta) || ta.includes(t)) return true;
  
  // Simple Levenshtein-like check for short strings
  if (ta.length <= 3) return t.includes(ta);
  
  let matches = 0;
  for (let i = 0; i < ta.length; i++) {
    if (t.includes(ta[i])) matches++;
  }
  return matches / ta.length >= threshold;
};

// Pending message state for conversation flow
interface PendingMessage {
  receiverId: string;
  receiverName: string;
}

export default function AIAssistant({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("staff");
  const [lastQuery, setLastQuery] = useState<string>(""); // Context memory
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null); // For message sending flow
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadUserAndProactiveMessages();
    // Check for new messages periodically
    const interval = setInterval(checkNewMessages, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Check for new incoming messages
  const checkNewMessages = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newMsgs, error } = await supabase
      .from("internal_messages")
      .select("*, sender:sender_id(name)")
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (!error && newMsgs) {
      setUnreadMessages(newMsgs.length);
    }
  };

  const loadUserAndProactiveMessages = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
    const name = profile?.name || "Kullanıcı";
    const role = profile?.role || "staff";
    setUserName(name);
    setUserRole(role);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    let query = supabase.from("visa_files").select("*").eq("arsiv_mi", false);
    
    if (role !== "admin") {
      query = query.eq("assigned_user_id", user.id);
    }

    const { data: files } = await query;

    // Check for incoming messages
    const { data: incomingMessages } = await supabase
      .from("internal_messages")
      .select("*, sender:sender_id(name)")
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(5);

    setUnreadMessages(incomingMessages?.length || 0);

    const welcomeMessages: Message[] = [];
    
    // Greeting
    const greetingTime = new Date().getHours();
    let timeGreeting = "Merhaba";
    if (greetingTime < 12) timeGreeting = "Günaydın";
    else if (greetingTime < 18) timeGreeting = "İyi günler";
    else timeGreeting = "İyi akşamlar";

    const roleText = role === "admin" ? "tüm ofis verileri ve personel performansı" : "dosyalarınız";
    welcomeMessages.push({
      id: "greeting",
      type: "ai",
      content: `${timeGreeting} ${name}! 🦊\n\nBen FOX AI, ${roleText} hakkında size yardımcı olmak için buradayım.\n\n🧠 Akıllı arama, istatistik ve öneriler sunabilirim.`,
      timestamp: new Date(),
    });

    if (files && files.length > 0) {
      const alerts: string[] = [];
      const priorities: string[] = [];

      // Today's appointments (urgent)
      const todayAppts = files.filter(f => {
        if (!f.randevu_tarihi) return false;
        const apptDate = new Date(f.randevu_tarihi);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return apptDate >= today && apptDate < tomorrow;
      });
      if (todayAppts.length > 0) {
        alerts.push(`🔴 ${todayAppts.length} randevu BUGÜN!`);
        priorities.push("Bugünkü randevuları kontrol edin");
      }

      // Upcoming appointments (2 days)
      const upcomingAppointments = files.filter(f => {
        if (!f.randevu_tarihi) return false;
        const apptDate = new Date(f.randevu_tarihi);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return apptDate >= tomorrow && apptDate <= twoDaysLater;
      });
      if (upcomingAppointments.length > 0) {
        alerts.push(`📅 ${upcomingAppointments.length} yaklaşan randevu (2 gün içi)`);
      }

      // Missing docs (urgent if has appointment)
      const missingDocs = files.filter(f => f.evrak_eksik_mi === true);
      const missingDocsWithAppt = missingDocs.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) <= weekLater);
      if (missingDocsWithAppt.length > 0) {
        alerts.push(`⚠️ ${missingDocsWithAppt.length} eksik evraklı dosyada yakın randevu var!`);
        priorities.push("Eksik evrakları tamamlayın");
      } else if (missingDocs.length > 0) {
        alerts.push(`📋 ${missingDocs.length} eksik evraklı dosya`);
      }

      // Unpaid files
      const unpaidInProgress = files.filter(f => f.odeme_durumu === "odenmedi" && f.odeme_plani === "cari" && !f.arsiv_mi);
      if (unpaidInProgress.length > 0) {
        const totalTL = unpaidInProgress.filter(f => (f.ucret_currency || "TL") === "TL").reduce((sum, f) => sum + (f.ucret || 0), 0);
        alerts.push(`💰 ${unpaidInProgress.length} ödenmemiş dosya${totalTL > 0 ? ` (${totalTL.toLocaleString("tr-TR")} TL)` : ""}`);
      }

      // Files ready for processing
      const readyFiles = files.filter(f => f.dosya_hazir && !f.basvuru_yapildi && !f.arsiv_mi);
      if (readyFiles.length > 0) {
        alerts.push(`✅ ${readyFiles.length} dosya işleme hazır`);
      }

      // Active files summary
      const activeFiles = files.filter(f => !f.sonuc && !f.arsiv_mi);
      alerts.push(`📁 ${activeFiles.length} aktif dosya`);

      // Success rate (for context)
      const completed = files.filter(f => f.sonuc !== null);
      const approved = files.filter(f => f.sonuc === "vize_onay");
      if (completed.length >= 5) {
        const rate = Math.round((approved.length / completed.length) * 100);
        alerts.push(`📈 Başarı oranı: %${rate}`);
      }

      if (alerts.length > 0) {
        welcomeMessages.push({
          id: "alerts",
          type: "system",
          content: "📊 Güncel Durum:\n\n" + alerts.join("\n"),
          timestamp: new Date(),
        });
      }

      // Priorities (if any)
      if (priorities.length > 0) {
        welcomeMessages.push({
          id: "priorities",
          type: "ai",
          content: `🎯 Öncelikli işler:\n${priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
          timestamp: new Date(),
        });
      }
    }

    // Show incoming messages
    if (incomingMessages && incomingMessages.length > 0) {
      welcomeMessages.push({
        id: "incoming-messages",
        type: "system",
        content: `📬 **${incomingMessages.length} Okunmamış Mesaj**\n\n` +
          incomingMessages.slice(0, 3).map((m: any) => 
            `💬 ${m.sender?.name || "Bilinmeyen"}: "${m.message.substring(0, 50)}${m.message.length > 50 ? '...' : ''}"`
          ).join("\n") +
          `\n\n"Mesajları göster" yazarak tümünü görebilirsiniz.`,
        timestamp: new Date(),
      });
    }

    // Help hints
    const staffHints = `💡 Sorabilecekleriniz:\n\n` +
      `📅 "Bugün/yarın randevum var mı?"\n` +
      `💰 "Ödenmemiş dosyalarım"\n` +
      `📋 "Eksik evraklı dosyalar"\n` +
      `🔄 "İşlemde olan dosyalar"\n` +
      `🎯 "Bugün ne yapmalıyım?"\n` +
      `✉️ "Davut Bey'e mesaj gönder"\n` +
      `🔍 Müşteri adı ile arama`;
    
    const adminHints = `💡 Sorabilecekleriniz:\n\n` +
      `📊 "Genel istatistikler"\n` +
      `👥 "Personel performansı"\n` +
      `🏆 "Kim en çok vize çıkardı?"\n` +
      `💰 "Toplam gelir/ciro"\n` +
      `📅 "Bugün kaç randevu var?"\n` +
      `✉️ "BAHAR'a mesaj gönder"\n` +
      `🔍 "BAHAR'ın dosyaları"`;

    welcomeMessages.push({
      id: "hint",
      type: "ai",
      content: role === "admin" ? adminHints : staffHints,
      timestamp: new Date(),
    });

    setMessages(welcomeMessages);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setLastQuery(currentInput);
    setInput("");
    setIsLoading(true);

    try {
      // Check if we're in message sending mode
      if (pendingMessage) {
        const response = await sendInternalMessage(currentInput, pendingMessage);
        setMessages(prev => [...prev, response]);
        setPendingMessage(null);
      } else {
        const response = await processQuery(currentInput);
        setMessages(prev => [...prev, response]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: "ai",
        content: "Bir hata oluştu. Lütfen tekrar deneyin. 🦊",
        timestamp: new Date(),
      }]);
      setPendingMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Send internal message
  const sendInternalMessage = async (messageText: string, pending: PendingMessage): Promise<Message> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { id: Date.now().toString(), type: "ai", content: "Oturum bulunamadı.", timestamp: new Date() };
    }

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    const senderName = profile?.name || "Bilinmeyen";

    // Insert the message
    const { error: msgError } = await supabase.from("internal_messages").insert({
      sender_id: user.id,
      receiver_id: pending.receiverId,
      message: messageText,
    });

    if (msgError) {
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `❌ Mesaj gönderilemedi: ${msgError.message}`,
        timestamp: new Date(),
      };
    }

    // Also create a notification for the receiver
    await supabase.from("notifications").insert({
      user_id: pending.receiverId,
      kind: "internal_message",
      title: "Yeni Mesaj",
      body: `${senderName}'dan mesaj: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`,
      unique_key: `msg:${user.id}:${pending.receiverId}:${Date.now()}`,
    });

    return {
      id: Date.now().toString(),
      type: "ai",
      content: `✅ Mesajınız ${pending.receiverName}'a gönderildi! 📬\n\n💬 "${messageText}"`,
      timestamp: new Date(),
    };
  };

  const processQuery = async (query: string): Promise<Message> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { id: Date.now().toString(), type: "ai", content: "Oturum bulunamadı. Lütfen tekrar giriş yapın.", timestamp: new Date() };
    }

    const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
    const currentUserRole = profile?.role || "staff";
    const currentUserName = profile?.name || "Kullanıcı";

    const queryLower = normalizeText(query);

    // Get staff list for admin queries
    const { data: staffList } = await supabase.from("profiles").select("id, name, role").eq("role", "staff");
    
    // Get all files (filtered by role)
    let filesQuery = supabase.from("visa_files").select("*, profiles:assigned_user_id(name)");
    if (currentUserRole !== "admin") {
      filesQuery = filesQuery.eq("assigned_user_id", user.id);
    }
    const { data: allFiles } = await filesQuery;
    
    // Get payments for revenue calculations
    const { data: payments } = await supabase.from("payments").select("*").eq("durum", "odendi");

    const files = allFiles || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    const monthLater = new Date(today);
    monthLater.setDate(monthLater.getDate() + 30);

    // ============================================
    // MESSAGING SYSTEM
    // ============================================
    
    // Show messages
    if (queryLower.includes('mesaj') && (queryLower.includes('goster') || queryLower.includes('oku') || queryLower.includes('goruntule') || queryLower.includes('bak'))) {
      const { data: allMessages } = await supabase
        .from("internal_messages")
        .select("*, sender:sender_id(name)")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!allMessages || allMessages.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "📭 Hiç mesajınız bulunmuyor.",
          timestamp: new Date(),
        };
      }

      // Mark messages as read
      const unreadIds = allMessages.filter((m: any) => !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("internal_messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in("id", unreadIds);
        setUnreadMessages(0);
      }

      return {
        id: Date.now().toString(),
        type: "ai",
        content: `📬 **Mesajlarınız** (${allMessages.length} adet)\n\n` +
          allMessages.map((m: any) => {
            const date = new Date(m.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            const readStatus = m.is_read ? "" : "🔴 ";
            return `${readStatus}**${m.sender?.name || "?"}** (${date}):\n"${m.message}"`;
          }).join("\n\n"),
        timestamp: new Date(),
      };
    }

    // Send message - detect intent
    if (queryLower.includes('mesaj') && (queryLower.includes('gonder') || queryLower.includes('yaz') || queryLower.includes('at') || queryLower.includes('ilet'))) {
      // Get all users for matching
      const { data: allUsers } = await supabase.from("profiles").select("id, name, role");
      
      if (!allUsers) {
        return { id: Date.now().toString(), type: "ai", content: "Kullanıcı listesi alınamadı.", timestamp: new Date() };
      }

      // Find mentioned user
      const otherUsers = allUsers.filter(u => u.id !== user.id);
      let targetUser = null;

      // Check for specific names
      for (const u of otherUsers) {
        const nameLower = normalizeText(u.name);
        if (queryLower.includes(nameLower) || queryLower.includes(nameLower.split(' ')[0])) {
          targetUser = u;
          break;
        }
      }

      // Special handling for "davut bey"
      if (!targetUser && (queryLower.includes('davut') || queryLower.includes('admin') || queryLower.includes('yonetici') || queryLower.includes('mudur') || queryLower.includes('patron'))) {
        targetUser = allUsers.find(u => u.role === "admin");
      }

      if (!targetUser) {
        // Ask who to send to
        const userList = otherUsers.map(u => `• ${u.name}`).join("\n");
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📬 Kime mesaj göndermek istiyorsunuz?\n\n${userList}\n\nÖrnek: "BAHAR'a mesaj gönder"`,
          timestamp: new Date(),
        };
      }

      // Set pending message state
      setPendingMessage({
        receiverId: targetUser.id,
        receiverName: targetUser.name,
      });

      return {
        id: Date.now().toString(),
        type: "ai",
        content: `✉️ **${targetUser.name}**'a mesaj gönderilecek.\n\nMesajınızı yazın:`,
        timestamp: new Date(),
      };
    }

    // ============================================
    // HELP / COMMANDS
    // ============================================
    if (hasKeyword(query, 'help') || queryLower.includes('ne sor') || queryLower === 'yardim') {
      const staffHelp = `🦊 **FOX AI Komutları**\n\n` +
        `📅 **Randevu:**\n• "En yakın randevum"\n• "Bugün/yarın randevu var mı?"\n• "Bu hafta randevularım"\n\n` +
        `💰 **Ödeme:**\n• "Ödenmemiş dosyalarım"\n• "Bekleyen ödemeler"\n\n` +
        `📋 **Evrak:**\n• "Eksik evraklı dosyalar"\n\n` +
        `🔄 **Durum:**\n• "İşlemde olan dosyalar"\n• "Hazır dosyalar"\n• "Onaylanan vizeler"\n• "Red dosyaları"\n\n` +
        `🎯 **Öneri:**\n• "Bugün ne yapmalıyım?"\n• "Öncelikli işler"\n\n` +
        `🔍 **Arama:**\n• Müşteri adı yazın\n• "Almanya dosyaları"`;
      
      const adminHelp = `🦊 **FOX AI Komutları**\n\n` +
        `📊 **İstatistik:**\n• "Genel istatistikler"\n• "Toplam gelir/ciro"\n• "Başarı oranları"\n\n` +
        `👥 **Personel:**\n• "Personel performansı"\n• "BAHAR kaç dosya yaptı?"\n• "Kim en çok vize çıkardı?"\n• "En verimli personel"\n\n` +
        `📅 **Randevu:**\n• "Bugün kaç randevu var?"\n• "Bu hafta randevular"\n\n` +
        `💰 **Ödeme:**\n• "Ödenmemiş dosyalar"\n• "Bekleyen tahsilatlar"\n\n` +
        `🌍 **Ülke:**\n• "Almanya başarı oranı"\n• "Hangi ülkede en çok red?"\n\n` +
        `🔍 **Arama:**\n• Müşteri/personel adı`;
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: currentUserRole === "admin" ? adminHelp : staffHelp,
        timestamp: new Date(),
      };
    }

    // ============================================
    // ADMIN ONLY QUERIES
    // ============================================
    if (currentUserRole === "admin") {
      
      // General statistics / summary
      if (hasKeyword(query, 'stats') || queryLower.includes('durum') || queryLower.includes('ozet')) {
        const stats = calculateGeneralStats(files, payments || []);
        const successRate = stats.approvedFiles + stats.rejectedFiles > 0 
          ? Math.round((stats.approvedFiles / (stats.approvedFiles + stats.rejectedFiles)) * 100) 
          : 0;
        
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📊 **Ofis Genel İstatistikleri**\n\n` +
            `📁 **Dosya Durumu:**\n` +
            `   • Toplam: ${stats.totalFiles}\n` +
            `   • Aktif: ${stats.activeFiles}\n` +
            `   • Hazır: ${stats.readyFiles}\n` +
            `   • İşlemde: ${stats.inProgressFiles}\n\n` +
            `✨ **Sonuçlar:**\n` +
            `   • Vize Onay: ${stats.approvedFiles} 🎉\n` +
            `   • Red: ${stats.rejectedFiles} ❌\n` +
            `   • Başarı Oranı: %${successRate}\n\n` +
            `📅 **Randevular:**\n` +
            `   • Bugün: ${stats.todayAppointments}\n` +
            `   • Bu Hafta: ${stats.weekAppointments}\n\n` +
            `💰 **Finansal:**\n` +
            `   • Ödenmemiş: ${stats.unpaidFiles} dosya\n` +
            `   • Toplam Gelir:\n` +
            `     - ${stats.totalRevenueTL.toLocaleString("tr-TR")} TL\n` +
            `     - ${stats.totalRevenueEUR.toLocaleString("tr-TR")} EUR\n` +
            `     - ${stats.totalRevenueUSD.toLocaleString("tr-TR")} USD\n\n` +
            `📋 Eksik Evrak: ${stats.missingDocsFiles} dosya`,
          timestamp: new Date(),
        };
      }

      // Revenue / income queries
      if (queryLower.includes('gelir') || queryLower.includes('kazanc') || queryLower.includes('ciro') || queryLower.includes('hasilat')) {
        const stats = calculateGeneralStats(files, payments || []);
        const totalPayments = payments?.length || 0;
        
        // This month payments
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const thisMonthPayments = payments?.filter(p => new Date(p.created_at) >= thisMonth) || [];
        const thisMonthTL = thisMonthPayments.filter(p => (p.currency || "TL") === "TL").reduce((sum, p) => sum + Number(p.tutar), 0);
        
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `💰 **Gelir Raporu**\n\n` +
            `📈 **Toplam Gelir:**\n` +
            `   • ${stats.totalRevenueTL.toLocaleString("tr-TR")} TL\n` +
            `   • ${stats.totalRevenueEUR.toLocaleString("tr-TR")} EUR\n` +
            `   • ${stats.totalRevenueUSD.toLocaleString("tr-TR")} USD\n\n` +
            `📅 **Bu Ay:**\n` +
            `   • ${thisMonthTL.toLocaleString("tr-TR")} TL\n` +
            `   • ${thisMonthPayments.length} ödeme\n\n` +
            `📊 Toplam ${totalPayments} ödeme kaydı\n\n` +
            `⏳ **Bekleyen:**\n` +
            `   • ${stats.unpaidFiles} ödenmemiş dosya`,
          timestamp: new Date(),
        };
      }

      // Staff performance / statistics
      if (hasKeyword(query, 'staff') || queryLower.includes('kim') || queryLower.includes('kac dosya')) {
        
        if (!staffList || staffList.length === 0) {
          return { id: Date.now().toString(), type: "ai", content: "Personel bilgisi alınamadı.", timestamp: new Date() };
        }

        const staffStats: StaffStats[] = staffList.map(staff => {
          const staffFiles = files.filter(f => f.assigned_user_id === staff.id);
          const completed = staffFiles.filter(f => f.sonuc !== null);
          const approved = staffFiles.filter(f => f.sonuc === "vize_onay");
          const successRate = completed.length > 0 ? Math.round((approved.length / completed.length) * 100) : 0;
          
          return {
            id: staff.id,
            name: staff.name,
            totalFiles: staffFiles.length,
            activeFiles: staffFiles.filter(f => !f.arsiv_mi && !f.sonuc).length,
            completedFiles: completed.length,
            approvedFiles: approved.length,
            rejectedFiles: staffFiles.filter(f => f.sonuc === "red").length,
            unpaidFiles: staffFiles.filter(f => f.odeme_durumu === "odenmedi" && !f.arsiv_mi).length,
            upcomingAppointments: staffFiles.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) >= today && new Date(f.randevu_tarihi) <= weekLater).length,
            todayAppointments: staffFiles.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) >= today && new Date(f.randevu_tarihi) < tomorrow).length,
            missingDocs: staffFiles.filter(f => f.evrak_eksik_mi === true && !f.arsiv_mi).length,
            successRate,
          };
        });

        // Specific staff member query
        const staffNames = staffList.map(s => normalizeText(s.name));
        const mentionedStaff = staffNames.find(name => queryLower.includes(name));

        if (mentionedStaff) {
          const staff = staffStats.find(s => normalizeText(s.name) === mentionedStaff);
          if (staff) {
            return {
              id: Date.now().toString(),
              type: "ai",
              content: `👤 **${staff.name} Detaylı Raporu**\n\n` +
                `📁 **Dosya İstatistikleri:**\n` +
                `   • Toplam: ${staff.totalFiles}\n` +
                `   • Aktif: ${staff.activeFiles}\n` +
                `   • Tamamlanan: ${staff.completedFiles}\n\n` +
                `✨ **Sonuçlar:**\n` +
                `   • Vize Onay: ${staff.approvedFiles} 🎉\n` +
                `   • Red: ${staff.rejectedFiles} ❌\n` +
                `   • Başarı Oranı: %${staff.successRate} ${staff.successRate >= 70 ? '🌟' : ''}\n\n` +
                `📅 **Randevular:**\n` +
                `   • Bugün: ${staff.todayAppointments}\n` +
                `   • Bu Hafta: ${staff.upcomingAppointments}\n\n` +
                `💰 Ödenmemiş: ${staff.unpaidFiles}\n` +
                `📋 Eksik Evrak: ${staff.missingDocs}`,
              timestamp: new Date(),
            };
          }
        }

        // Best performer queries
        if (queryLower.includes('en cok') || queryLower.includes('en fazla') || queryLower.includes('en iyi') || queryLower.includes('birinci') || queryLower.includes('sampion')) {
          if (queryLower.includes('vize') || queryLower.includes('onay') || queryLower.includes('basari')) {
            const sorted = [...staffStats].sort((a, b) => b.approvedFiles - a.approvedFiles);
            const winner = sorted[0];
            return {
              id: Date.now().toString(),
              type: "ai",
              content: `🏆 **Vize Onay Şampiyonu**\n\n` +
                `🥇 ${winner.name}: ${winner.approvedFiles} onay (%${winner.successRate} başarı)\n\n` +
                `📊 Sıralama:`,
              staffStats: sorted,
              timestamp: new Date(),
            };
          }
          
          if (queryLower.includes('verimli') || queryLower.includes('performans')) {
            const sorted = [...staffStats].sort((a, b) => b.successRate - a.successRate);
            const winner = sorted[0];
            return {
              id: Date.now().toString(),
              type: "ai",
              content: `🏆 **En Verimli Personel**\n\n` +
                `🥇 ${winner.name}: %${winner.successRate} başarı oranı\n` +
                `   (${winner.approvedFiles} onay / ${winner.completedFiles} tamamlanan)`,
              staffStats: sorted,
              timestamp: new Date(),
            };
          }

          const sorted = [...staffStats].sort((a, b) => b.totalFiles - a.totalFiles);
          const winner = sorted[0];
          return {
            id: Date.now().toString(),
            type: "ai",
            content: `🏆 **En Çok Dosya Yapan**\n\n` +
              `🥇 ${winner.name}: ${winner.totalFiles} dosya\n\n` +
              `📊 Sıralama:`,
            staffStats: sorted,
            timestamp: new Date(),
          };
        }

        // Least performer
        if (queryLower.includes('en az') || queryLower.includes('en dusuk')) {
          const sorted = [...staffStats].sort((a, b) => a.totalFiles - b.totalFiles);
          return {
            id: Date.now().toString(),
            type: "ai",
            content: `📊 **Dosya Sayısına Göre Sıralama**\n\n(En az → En çok)`,
            staffStats: sorted,
            timestamp: new Date(),
          };
        }

        // General staff comparison
        const sorted = [...staffStats].sort((a, b) => b.totalFiles - a.totalFiles);
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `👥 **Personel Performans Tablosu**\n\n📊 Toplam ${files.length} dosya`,
          staffStats: sorted,
          timestamp: new Date(),
        };
      }

      // Country success rate for admin
      const mentionedCountryAdmin = KEYWORDS.countries.find(c => queryLower.includes(c));
      if (mentionedCountryAdmin && (queryLower.includes('basari') || queryLower.includes('oran') || queryLower.includes('red'))) {
        const countryFiles = files.filter(f => normalizeText(f.hedef_ulke).includes(mentionedCountryAdmin));
        const completed = countryFiles.filter(f => f.sonuc !== null);
        const approved = countryFiles.filter(f => f.sonuc === "vize_onay");
        const rejected = countryFiles.filter(f => f.sonuc === "red");
        const successRate = completed.length > 0 ? Math.round((approved.length / completed.length) * 100) : 0;
        
        const countryName = mentionedCountryAdmin.charAt(0).toUpperCase() + mentionedCountryAdmin.slice(1);
        
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `🌍 **${countryName} Başarı Analizi**\n\n` +
            `📁 Toplam: ${countryFiles.length} dosya\n` +
            `✅ Onay: ${approved.length}\n` +
            `❌ Red: ${rejected.length}\n` +
            `📈 Başarı Oranı: %${successRate}\n\n` +
            `⏳ İşlemde: ${countryFiles.filter(f => !f.sonuc && !f.arsiv_mi).length}`,
          timestamp: new Date(),
        };
      }

      // Which country has most rejections
      if (queryLower.includes('hangi ulke') && queryLower.includes('red')) {
        const countryStats = KEYWORDS.countries.map(country => {
          const cFiles = files.filter(f => normalizeText(f.hedef_ulke).includes(country));
          return {
            country: country.charAt(0).toUpperCase() + country.slice(1),
            rejected: cFiles.filter(f => f.sonuc === "red").length,
            total: cFiles.length
          };
        }).filter(c => c.total > 0).sort((a, b) => b.rejected - a.rejected);
        
        if (countryStats.length === 0) {
          return { id: Date.now().toString(), type: "ai", content: "Henüz red kaydı bulunmuyor.", timestamp: new Date() };
        }
        
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `🌍 **Ülkelere Göre Red Sayıları**\n\n` +
            countryStats.slice(0, 5).map((c, i) => 
              `${i + 1}. ${c.country}: ${c.rejected} red (${c.total} toplam)`
            ).join("\n"),
          timestamp: new Date(),
        };
      }
    }

    // ============================================
    // COMMON QUERIES (Both Admin & Staff)
    // ============================================

    // Priority / What to do today
    if (hasKeyword(query, 'action') || queryLower.includes('ne yap') || queryLower.includes('oncelik') || queryLower.includes('yapilacak')) {
      const myFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      
      const todayAppts = myFiles.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) >= today && new Date(f.randevu_tarihi) < tomorrow);
      const missingUrgent = myFiles.filter(f => f.evrak_eksik_mi && f.randevu_tarihi && new Date(f.randevu_tarihi) <= weekLater);
      const unpaid = myFiles.filter(f => f.odeme_durumu === "odenmedi" && !f.arsiv_mi);
      const ready = myFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi && !f.arsiv_mi);
      const inProgress = myFiles.filter(f => f.basvuru_yapildi && !f.islemden_cikti && !f.arsiv_mi);
      
      const priorities: string[] = [];
      
      if (todayAppts.length > 0) {
        priorities.push(`🔴 ${todayAppts.length} randevu BUGÜN - kontrol edin!`);
      }
      if (missingUrgent.length > 0) {
        priorities.push(`⚠️ ${missingUrgent.length} dosyada ACİL evrak eksik`);
      }
      if (ready.length > 0) {
        priorities.push(`✅ ${ready.length} dosya işleme alınmayı bekliyor`);
      }
      if (unpaid.length > 0) {
        priorities.push(`💰 ${unpaid.length} ödeme tahsil edilmeli`);
      }
      if (inProgress.length > 0) {
        priorities.push(`🔄 ${inProgress.length} işlemde dosya takip edilmeli`);
      }
      
      if (priorities.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `🎉 Harika! Acil bekleyen işiniz yok.\n\n📊 Aktif ${myFiles.filter(f => !f.sonuc && !f.arsiv_mi).length} dosyanız var.`,
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `🎯 **Bugün Yapılması Gerekenler**\n\n` + priorities.map((p, i) => `${i + 1}. ${p}`).join("\n"),
        files: todayAppts.length > 0 ? todayAppts.slice(0, 3).map(f => formatFileInfo(f, currentUserRole === "admin")) : undefined,
        timestamp: new Date(),
      };
    }

    // Payment queries
    if (hasKeyword(query, 'payment')) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const unpaidFiles = targetFiles.filter(f => f.odeme_durumu === "odenmedi" && !f.arsiv_mi);
      
      if (unpaidFiles.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `✅ ${currentUserRole === "admin" ? "Ofiste" : "Size ait"} bekleyen ödeme bulunmuyor! 🎉`,
          timestamp: new Date(),
        };
      }
      
      // Group by currency
      const tlFiles = unpaidFiles.filter(f => (f.ucret_currency || "TL") === "TL");
      const eurFiles = unpaidFiles.filter(f => f.ucret_currency === "EUR");
      const usdFiles = unpaidFiles.filter(f => f.ucret_currency === "USD");
      
      const tlTotal = tlFiles.reduce((sum, f) => sum + (f.ucret || 0), 0);
      const eurTotal = eurFiles.reduce((sum, f) => sum + (f.ucret || 0), 0);
      const usdTotal = usdFiles.reduce((sum, f) => sum + (f.ucret || 0), 0);
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `💰 **Ödenmemiş Dosyalar** (${unpaidFiles.length} adet)\n\n` +
          `📊 **Bekleyen Tutar:**\n` +
          (tlTotal > 0 ? `   • ${tlTotal.toLocaleString("tr-TR")} TL\n` : "") +
          (eurTotal > 0 ? `   • ${eurTotal.toLocaleString("tr-TR")} EUR\n` : "") +
          (usdTotal > 0 ? `   • ${usdTotal.toLocaleString("tr-TR")} USD\n` : "") +
          `\n📋 Dosya listesi:`,
        files: unpaidFiles.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Appointment queries
    if (hasKeyword(query, 'appointment') || queryLower.includes('randevu')) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      
      // "En yakın randevu"
      if (queryLower.includes('en yakin') || queryLower.includes('ilk') || queryLower.includes('siradaki') || queryLower.includes('sonraki')) {
        const allFutureAppointments = targetFiles.filter(f => {
          if (!f.randevu_tarihi) return false;
          return new Date(f.randevu_tarihi) >= today;
        }).sort((a, b) => new Date(a.randevu_tarihi!).getTime() - new Date(b.randevu_tarihi!).getTime());

        if (allFutureAppointments.length === 0) {
          return {
            id: Date.now().toString(),
            type: "ai",
            content: "📅 Gelecekte planlanmış randevu bulunmuyor.",
            timestamp: new Date(),
          };
        }

        const nearest = allFutureAppointments[0];
        const nearestDate = new Date(nearest.randevu_tarihi!);
        const diffDays = Math.ceil((nearestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let dayText = "";
        if (diffDays === 0) dayText = "🔴 BUGÜN!";
        else if (diffDays === 1) dayText = "🟡 Yarın";
        else if (diffDays <= 7) dayText = `🟢 ${diffDays} gün sonra`;
        else dayText = `${diffDays} gün sonra`;

        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📅 **En Yakın Randevu** (${dayText})\n\n📊 Toplam ${allFutureAppointments.length} yaklaşan randevu:`,
          files: allFutureAppointments.slice(0, 5).map(f => formatFileInfo(f, currentUserRole === "admin")),
          timestamp: new Date(),
        };
      }

      // All appointments
      if (queryLower.includes('tum') || queryLower.includes('butun') || queryLower.includes('hepsi') || queryLower.includes('liste')) {
        const allFutureAppointments = targetFiles.filter(f => {
          if (!f.randevu_tarihi) return false;
          return new Date(f.randevu_tarihi) >= today;
        }).sort((a, b) => new Date(a.randevu_tarihi!).getTime() - new Date(b.randevu_tarihi!).getTime());

        if (allFutureAppointments.length === 0) {
          return {
            id: Date.now().toString(),
            type: "ai",
            content: "📅 Gelecekte planlanmış randevu bulunmuyor.",
            timestamp: new Date(),
          };
        }

        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📅 **Tüm Randevular** (${allFutureAppointments.length} adet)`,
          files: allFutureAppointments.slice(0, 8).map(f => formatFileInfo(f, currentUserRole === "admin")),
          timestamp: new Date(),
        };
      }
      
      // Time-specific queries
      let filterDate = twoDaysLater;
      let periodText = "2 gün içinde";
      
      if (queryLower.includes('bugun')) {
        const todayAppts = targetFiles.filter(f => {
          if (!f.randevu_tarihi) return false;
          const apptDate = new Date(f.randevu_tarihi);
          return apptDate >= today && apptDate < tomorrow;
        });
        
        if (todayAppts.length === 0) {
          return {
            id: Date.now().toString(),
            type: "ai",
            content: "📅 Bugün randevu bulunmuyor. ✨",
            timestamp: new Date(),
          };
        }
        
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📅 **Bugün ${todayAppts.length} Randevu Var!**`,
          files: todayAppts.map(f => formatFileInfo(f, currentUserRole === "admin")),
          timestamp: new Date(),
        };
      }
      
      if (queryLower.includes('yarin')) {
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        const tomorrowAppts = targetFiles.filter(f => {
          if (!f.randevu_tarihi) return false;
          const apptDate = new Date(f.randevu_tarihi);
          return apptDate >= tomorrow && apptDate < tomorrowEnd;
        });
        
        if (tomorrowAppts.length === 0) {
          return {
            id: Date.now().toString(),
            type: "ai",
            content: "📅 Yarın randevu bulunmuyor. ✨",
            timestamp: new Date(),
          };
        }
        
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📅 **Yarın ${tomorrowAppts.length} Randevu Var**`,
          files: tomorrowAppts.map(f => formatFileInfo(f, currentUserRole === "admin")),
          timestamp: new Date(),
        };
      }
      
      if (queryLower.includes('hafta')) {
        filterDate = weekLater;
        periodText = "bu hafta";
      } else if (queryLower.includes('ay')) {
        filterDate = monthLater;
        periodText = "bu ay";
      }

      const appointments = targetFiles.filter(f => {
        if (!f.randevu_tarihi) return false;
        const apptDate = new Date(f.randevu_tarihi);
        return apptDate >= today && apptDate < filterDate;
      }).sort((a, b) => new Date(a.randevu_tarihi!).getTime() - new Date(b.randevu_tarihi!).getTime());

      if (appointments.length === 0) {
        // Show nearest if none in period
        const allFuture = targetFiles.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) >= today)
          .sort((a, b) => new Date(a.randevu_tarihi!).getTime() - new Date(b.randevu_tarihi!).getTime());

        if (allFuture.length > 0) {
          const nearest = allFuture[0];
          const diffDays = Math.ceil((new Date(nearest.randevu_tarihi!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            id: Date.now().toString(),
            type: "ai",
            content: `📅 ${periodText.charAt(0).toUpperCase() + periodText.slice(1)} randevu yok.\n\n💡 En yakın randevunuz ${diffDays} gün sonra:`,
            files: [formatFileInfo(nearest, currentUserRole === "admin")],
            timestamp: new Date(),
          };
        }

        return {
          id: Date.now().toString(),
          type: "ai",
          content: `📅 ${periodText.charAt(0).toUpperCase() + periodText.slice(1)} randevu bulunmuyor.`,
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `📅 **${periodText.charAt(0).toUpperCase() + periodText.slice(1)} ${appointments.length} Randevu**`,
        files: appointments.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Missing documents
    if (hasKeyword(query, 'document') && (queryLower.includes('eksik') || queryLower.includes('tamam'))) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const missingDocs = targetFiles.filter(f => f.evrak_eksik_mi === true && !f.arsiv_mi);
      
      if (missingDocs.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "✅ Eksik evraklı dosya bulunmuyor! 🎉",
          timestamp: new Date(),
        };
      }
      
      // Highlight urgent ones
      const urgent = missingDocs.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) <= weekLater);
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `📋 **Eksik Evraklı Dosyalar** (${missingDocs.length} adet)\n\n` +
          (urgent.length > 0 ? `⚠️ ${urgent.length} tanesinin yakın randevusu var!\n\n` : "") +
          `📋 Dosya listesi:`,
        files: missingDocs.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // In progress files
    if (queryLower.includes('islemde') || queryLower.includes('devam') || (queryLower.includes('bekle') && !queryLower.includes('odeme'))) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const inProgress = targetFiles.filter(f => f.basvuru_yapildi && !f.islemden_cikti && !f.arsiv_mi);
      
      if (inProgress.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "🔄 İşlemde olan dosya bulunmuyor.",
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `🔄 **İşlemde Olan Dosyalar** (${inProgress.length} adet)\n\nKonsoloslukta/elçilikte bekleyen dosyalar:`,
        files: inProgress.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Ready files
    if (queryLower.includes('hazir') && !queryLower.includes('evrak')) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const ready = targetFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi && !f.arsiv_mi);
      
      if (ready.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "✅ Hazır bekleyen dosya bulunmuyor.",
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `✅ **İşleme Hazır Dosyalar** (${ready.length} adet)\n\nBaşvuruya hazır dosyalar:`,
        files: ready.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Completed / approved files
    if (queryLower.includes('onay') || queryLower.includes('vize cikti') || queryLower.includes('basarili') || queryLower.includes('tamamlanan')) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const approved = targetFiles.filter(f => f.sonuc === "vize_onay");
      
      if (approved.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "🎉 Henüz vize onaylı dosya bulunmuyor.",
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `🎉 **Vize Onaylı Dosyalar** (${approved.length} adet)`,
        files: approved.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Rejected files
    if (queryLower.includes('red') || queryLower.includes('ret') || queryLower.includes('olumsuz')) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const rejected = targetFiles.filter(f => f.sonuc === "red");
      
      if (rejected.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "✅ Reddedilmiş dosya bulunmuyor! 🎉",
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `❌ **Reddedilen Dosyalar** (${rejected.length} adet)`,
        files: rejected.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // New files
    if (queryLower.includes('yeni') && (queryLower.includes('dosya') || queryLower.includes('kayit'))) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const newFiles = targetFiles.filter(f => !f.dosya_hazir && !f.arsiv_mi);
      
      if (newFiles.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: "📁 Yeni dosya bulunmuyor.",
          timestamp: new Date(),
        };
      }
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `📁 **Yeni Dosyalar** (${newFiles.length} adet)\n\nHenüz hazırlanmamış dosyalar:`,
        files: newFiles.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Country-specific queries
    const mentionedCountry = KEYWORDS.countries.find(c => queryLower.includes(c));
    if (mentionedCountry) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const countryFiles = targetFiles.filter(f => normalizeText(f.hedef_ulke).includes(mentionedCountry));
      
      if (countryFiles.length === 0) {
        return {
          id: Date.now().toString(),
          type: "ai",
          content: `🌍 ${mentionedCountry.charAt(0).toUpperCase() + mentionedCountry.slice(1)} için dosya bulunmuyor.`,
          timestamp: new Date(),
        };
      }
      
      const active = countryFiles.filter(f => !f.sonuc && !f.arsiv_mi);
      const approved = countryFiles.filter(f => f.sonuc === "vize_onay");
      const rejected = countryFiles.filter(f => f.sonuc === "red");
      const successRate = approved.length + rejected.length > 0 
        ? Math.round((approved.length / (approved.length + rejected.length)) * 100) 
        : 0;
      
      const countryName = mentionedCountry.charAt(0).toUpperCase() + mentionedCountry.slice(1);
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `🌍 **${countryName} Dosyaları**\n\n` +
          `📁 Toplam: ${countryFiles.length}\n` +
          `⏳ Aktif: ${active.length}\n` +
          `✅ Onay: ${approved.length}\n` +
          `❌ Red: ${rejected.length}\n` +
          `📈 Başarı: %${successRate}`,
        files: countryFiles.slice(0, 5).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Active files count
    if ((queryLower.includes('kac') || queryLower.includes('sayisi')) && queryLower.includes('dosya')) {
      const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
      const active = targetFiles.filter(f => !f.sonuc && !f.arsiv_mi);
      const completed = targetFiles.filter(f => f.sonuc !== null);
      const approved = targetFiles.filter(f => f.sonuc === "vize_onay");
      
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `📊 **Dosya İstatistikleri**\n\n` +
          `📁 Toplam: ${targetFiles.length}\n` +
          `⏳ Aktif: ${active.length}\n` +
          `✅ Tamamlanan: ${completed.length}\n` +
          `🎉 Onaylanan: ${approved.length}`,
        timestamp: new Date(),
      };
    }

    // Search by customer name (fallback)
    const searchTerms = query.split(" ").filter(t => t.length > 2);
    const targetFiles = currentUserRole === "admin" ? files : files.filter(f => f.assigned_user_id === user.id);
    const matchingFiles = targetFiles.filter(f => {
      const searchText = normalizeText(`${f.musteri_ad} ${f.hedef_ulke} ${f.pasaport_no}`);
      return searchTerms.some(term => searchText.includes(normalizeText(term)));
    });

    if (matchingFiles.length > 0) {
      return {
        id: Date.now().toString(),
        type: "ai",
        content: `🔍 **"${query}" Arama Sonuçları** (${matchingFiles.length} dosya)`,
        files: matchingFiles.slice(0, 6).map(f => formatFileInfo(f, currentUserRole === "admin")),
        timestamp: new Date(),
      };
    }

    // Default help response
    return {
      id: Date.now().toString(),
      type: "ai",
      content: `🤔 Anlamadım. Şunu mu demek istediniz?\n\n` +
        `• "Bugün randevum var mı?"\n` +
        `• "Ödenmemiş dosyalarım"\n` +
        `• "Ne yapmalıyım?"\n` +
        `• "${query}" müşterisi\n\n` +
        `💡 "Yardım" yazarak tüm komutları görebilirsiniz.`,
      timestamp: new Date(),
    };
  };

  const calculateGeneralStats = (files: any[], payments: any[]): GeneralStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    const activeFiles = files.filter(f => !f.arsiv_mi);
    
    return {
      totalFiles: files.length,
      activeFiles: activeFiles.filter(f => !f.sonuc).length,
      todayAppointments: activeFiles.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) >= today && new Date(f.randevu_tarihi) < tomorrow).length,
      weekAppointments: activeFiles.filter(f => f.randevu_tarihi && new Date(f.randevu_tarihi) >= today && new Date(f.randevu_tarihi) < weekLater).length,
      unpaidFiles: activeFiles.filter(f => f.odeme_durumu === "odenmedi").length,
      missingDocsFiles: activeFiles.filter(f => f.evrak_eksik_mi === true).length,
      approvedFiles: files.filter(f => f.sonuc === "vize_onay").length,
      rejectedFiles: files.filter(f => f.sonuc === "red").length,
      inProgressFiles: activeFiles.filter(f => f.basvuru_yapildi && !f.islemden_cikti).length,
      readyFiles: activeFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi).length,
      totalRevenueTL: payments.filter(p => (p.currency || "TL") === "TL").reduce((sum, p) => sum + Number(p.tutar), 0),
      totalRevenueEUR: payments.filter(p => p.currency === "EUR").reduce((sum, p) => sum + Number(p.tutar), 0),
      totalRevenueUSD: payments.filter(p => p.currency === "USD").reduce((sum, p) => sum + Number(p.tutar), 0),
    };
  };

  const formatFileInfo = (file: any, showStaff: boolean = false): FileInfo => {
    let durum = "Yeni";
    if (file.sonuc === "vize_onay") durum = "Vize Onay";
    else if (file.sonuc === "red") durum = "Red";
    else if (file.islemden_cikti) durum = "Çıktı";
    else if (file.basvuru_yapildi) durum = "İşlemde";
    else if (file.dosya_hazir) durum = "Hazır";

    return {
      id: file.id,
      musteri_ad: file.musteri_ad,
      hedef_ulke: file.hedef_ulke,
      durum,
      randevu_tarihi: file.randevu_tarihi || undefined,
      odeme_durumu: file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi",
      staff_name: showStaff ? file.profiles?.name : undefined,
      ucret: file.ucret,
      ucret_currency: file.ucret_currency,
    };
  };

  const navigateToFile = (fileId: string) => {
    const basePath = isAdmin ? "/admin/files" : "/app/files";
    router.push(`${basePath}?file=${fileId}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date >= today && date < tomorrow) {
      return `Bugün ${date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-navy-800/50 border border-navy-700 rounded-xl overflow-hidden h-full flex flex-col">
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">🦊</span>
          </div>
          <div>
            <span className="font-semibold text-white text-sm">FOX AI</span>
            <span className="text-xs text-white/70 ml-2">Akıllı Asistan</span>
          </div>
        </div>
        {unreadMessages > 0 && (
          <div className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadMessages}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[95%] rounded-xl px-3 py-2 ${
              msg.type === "user" 
                ? "bg-primary-500 text-white" 
                : msg.type === "system"
                  ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                  : "bg-navy-700 text-navy-100"
            }`}>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              
              {msg.staffStats && msg.staffStats.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {msg.staffStats.map((staff, idx) => (
                    <div key={staff.id} className="bg-navy-600/50 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-navy-400'}`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </span>
                          <span className="text-xs font-medium text-white">{staff.name}</span>
                        </div>
                        <span className="text-xs font-bold text-primary-400">{staff.totalFiles} dosya</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        <div className="text-center">
                          <span className="text-navy-400">Aktif</span>
                          <p className="font-medium text-white">{staff.activeFiles}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-navy-400">Onay</span>
                          <p className="font-medium text-green-400">{staff.approvedFiles}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-navy-400">Red</span>
                          <p className="font-medium text-red-400">{staff.rejectedFiles}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-navy-400">Başarı</span>
                          <p className={`font-medium ${staff.successRate >= 70 ? 'text-green-400' : staff.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>%{staff.successRate}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {msg.files && msg.files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {msg.files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => navigateToFile(file.id)}
                      className="w-full bg-navy-600/50 hover:bg-navy-600 rounded-lg p-2 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">{file.musteri_ad}</p>
                          <p className="text-xs text-navy-400">{file.hedef_ulke} {file.staff_name && `• ${file.staff_name}`}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                          file.durum === "Vize Onay" ? "bg-green-500/20 text-green-300" :
                          file.durum === "Red" ? "bg-red-500/20 text-red-300" :
                          file.durum === "İşlemde" ? "bg-blue-500/20 text-blue-300" :
                          file.durum === "Hazır" ? "bg-amber-500/20 text-amber-300" :
                          "bg-navy-500/50 text-navy-300"
                        }`}>
                          {file.durum}
                        </span>
                      </div>
                      {file.randevu_tarihi && (
                        <p className="text-xs text-navy-400 mt-1">📅 {formatDate(file.randevu_tarihi)}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs ${file.odeme_durumu === "Ödendi" ? "text-green-400" : "text-amber-400"}`}>
                          {file.odeme_durumu === "Ödendi" ? "💰" : "⏳"} {file.odeme_durumu}
                          {file.ucret && file.odeme_durumu !== "Ödendi" && ` (${file.ucret} ${file.ucret_currency || "TL"})`}
                        </span>
                        <span className="text-xs text-primary-400">Detay →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-navy-700 rounded-xl px-4 py-2">
              <div className="flex gap-1 items-center">
                <span className="text-xs text-navy-400 mr-2">Düşünüyor</span>
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-navy-700 flex-shrink-0">
        {pendingMessage && (
          <div className="flex items-center justify-between bg-primary-500/20 rounded-lg px-3 py-1.5 mb-2">
            <span className="text-xs text-primary-300">✉️ {pendingMessage.receiverName}'a mesaj yazılıyor...</span>
            <button 
              onClick={() => {
                setPendingMessage(null);
                setMessages(prev => [...prev, { id: Date.now().toString(), type: "ai", content: "Mesaj iptal edildi.", timestamp: new Date() }]);
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              İptal
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={pendingMessage ? "Mesajınızı yazın..." : "Bir şey sor... (örn: bugün randevum var mı?)"}
            className="flex-1 bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-xs text-white placeholder-navy-400 focus:outline-none focus:border-primary-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-primary-500 hover:bg-primary-600 disabled:bg-navy-600 disabled:cursor-not-allowed rounded-lg px-3 py-2 transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
