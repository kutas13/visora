"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface FileCard {
  id: string;
  musteri_ad: string;
  hedef_ulke: string;
  durum: string;
  randevu_tarihi: string | null;
  odeme_durumu: string;
  ucret: number | null;
  ucret_currency: string;
  staff_name?: string;
}

interface Message {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  files?: FileCard[];
  timestamp: Date;
}

interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}

interface PendingMessage {
  receiverId: string;
  receiverName: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function AIAssistant({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single();

    const name = profile?.name || "Kullanıcı";
    const role = profile?.role || "staff";
    setUserName(name);

    const hour = new Date().getHours();
    let greeting = "Merhaba";
    if (hour < 12) greeting = "Günaydın";
    else if (hour < 18) greeting = "İyi günler";
    else greeting = "İyi akşamlar";

    setMessages([{
      id: "greeting",
      type: "ai",
      content: `${greeting}, ${name}!`,
      timestamp: new Date(),
    }]);
  };

  // Dahili mesaj gönderme
  const sendInternalMessage = async (messageText: string, pending: PendingMessage) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Oturum bulunamadı.";

    const { data: senderProfile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    const senderName = senderProfile?.name || "Bilinmeyen";

    try {
      const { error: msgError } = await supabase.from("internal_messages").insert({
        sender_id: user.id,
        receiver_id: pending.receiverId,
        message: messageText,
      });

      if (msgError) {
        return `❌ Mesaj gönderilemedi: ${msgError.message}`;
      }

      // Bildirim oluştur
      try {
        await supabase.from("notifications").insert({
          user_id: pending.receiverId,
          kind: "internal_message",
          title: "Yeni Mesaj",
          body: `${senderName}'dan mesaj: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`,
          unique_key: `msg:${user.id}:${pending.receiverId}:${Date.now()}`,
        });
      } catch {
        // Bildirim hatası yoksay
      }

      return `✅ Mesajınız **${pending.receiverName}**'a gönderildi!\n\n💬 "${messageText}"`;
    } catch {
      return "❌ Mesaj gönderme sırasında hata oluştu.";
    }
  };

  // Mesaj gönderme akışını başlat - kullanıcı listesini göster
  const startMessageFlow = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: allUsers } = await supabase.from("profiles").select("id, name, role");
    if (!allUsers) return;

    const otherUsers = allUsers.filter(u => u.id !== user.id);
    setUserOptions(otherUsers);
    setShowUserPicker(true);

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: "ai",
      content: "📬 Kime mesaj göndermek istiyorsunuz? Aşağıdan seçin:",
      timestamp: new Date(),
    }]);
  };

  // Kullanıcı seçildiğinde
  const handlePickUser = (user: UserOption) => {
    setShowUserPicker(false);
    setPendingMessage({ receiverId: user.id, receiverName: user.name });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: "ai",
      content: `✉️ **${user.name}**'a mesaj gönderilecek.\n\nMesajınızı yazın:`,
      timestamp: new Date(),
    }]);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !userId) return;

    const userText = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Eğer mesaj gönderme modundayız
      if (pendingMessage) {
        const result = await sendInternalMessage(userText, pendingMessage);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: result,
          timestamp: new Date(),
        }]);
        setPendingMessage(null);
        setIsLoading(false);
        return;
      }

      // Normal AI sorgusu
      const updatedHistory: ChatHistory[] = [
        ...chatHistory,
        { role: "user", content: userText },
      ];

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedHistory, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI yanıt veremedi");
      }

      const aiContent = data.content || "Yanıt alınamadı.";
      const fileCards: FileCard[] = data.files || [];
      const hasMessageIntent = data.messageIntent || false;

      // AI mesajını ekle
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: aiContent,
        files: fileCards.length > 0 ? fileCards : undefined,
        timestamp: new Date(),
      }]);

      // History güncelle
      setChatHistory([
        ...updatedHistory,
        { role: "assistant", content: aiContent },
      ]);

      // Mesaj gönderme niyeti varsa akışı başlat
      if (hasMessageIntent) {
        setTimeout(() => startMessageFlow(), 300);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: `❌ ${error.message || "Bir hata oluştu. Lütfen tekrar deneyin."}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setPendingMessage(null);
    setShowUserPicker(false);
    setUserOptions([]);
    initializeChat();
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
    if (date >= today && date < tomorrow) return "Bugün";
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) return "Yarın";
    if (diff > 0 && diff <= 7) return `${diff} gün sonra`;
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-primary-300 text-[11px]">$1</code>');
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  const getTimeStr = (date: Date) => {
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`bg-gradient-to-b from-[#0f172a] to-[#1e293b] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ease-in-out ${
      isExpanded ? "h-full" : "h-auto mt-auto"
    }`}>
      {/* Header */}
      <div
        className="relative overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/90 via-violet-600/80 to-primary-600/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ring-1 ring-white/20">
                <span className="text-sm font-bold text-white tracking-tight">V</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#1e293b] animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-white text-sm tracking-wide">Visora AI</p>
              <p className="text-[10px] text-white/60 font-medium">
                {isExpanded ? "Akıllı Asistanınız" : "Açmak için tıklayın"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isExpanded && chatHistory.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleClearChat(); }}
                className="p-1.5 text-white/50 hover:text-white/90 hover:bg-white/10 rounded-lg transition-all"
                title="Sohbeti temizle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <div className="p-1.5 text-white/50">
              <svg className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] group ${msg.type === "user" ? "" : "flex gap-2"}`}>
                  {msg.type !== "user" && (
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${
                        msg.type === "system"
                          ? "bg-amber-500/20 ring-1 ring-amber-500/30"
                          : "bg-gradient-to-br from-primary-500/30 to-violet-500/30 ring-1 ring-primary-500/20"
                      }`}>
                        {msg.type === "system" ? "⚡" : "V"}
                      </div>
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className={`rounded-2xl px-3.5 py-2.5 ${
                      msg.type === "user"
                        ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/20"
                        : msg.type === "system"
                          ? "bg-amber-500/10 text-amber-100/90 border border-amber-500/20"
                          : "bg-white/[0.06] text-slate-200 border border-white/[0.06]"
                    }`}>
                      <div className="text-xs leading-relaxed whitespace-pre-wrap">
                        {formatContent(msg.content)}
                      </div>
                    </div>

                    {/* Dosya Kartları */}
                    {msg.files && msg.files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.files.map((file) => {
                          // Kalan gün hesapla
                          let daysLeft: number | null = null;
                          let daysText = "";
                          if (file.randevu_tarihi) {
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const rd = new Date(file.randevu_tarihi);
                            rd.setHours(0, 0, 0, 0);
                            daysLeft = Math.ceil((rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysLeft === 0) daysText = "BUGÜN";
                            else if (daysLeft === 1) daysText = "Yarın";
                            else if (daysLeft > 0) daysText = `${daysLeft} gün kaldı`;
                            else daysText = `${Math.abs(daysLeft)} gün önce`;
                          }

                          return (
                            <div
                              key={file.id}
                              className="bg-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden"
                            >
                              {/* Üst kısım: İsim + Ülke + Durum */}
                              <div className="px-3 pt-3 pb-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-bold text-white truncate">{file.musteri_ad}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      🌍 {file.hedef_ulke}
                                      {file.staff_name && <span className="text-slate-500"> • {file.staff_name}</span>}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-semibold ${
                                    file.durum.includes("Onay") ? "bg-emerald-500/20 text-emerald-300" :
                                    file.durum.includes("Red") ? "bg-red-500/20 text-red-300" :
                                    file.durum.includes("İşlemde") ? "bg-blue-500/20 text-blue-300" :
                                    file.durum.includes("Hazır") ? "bg-amber-500/20 text-amber-300" :
                                    "bg-slate-500/20 text-slate-300"
                                  }`}>
                                    {file.durum}
                                  </span>
                                </div>

                                {/* Randevu + Kalan Gün */}
                                {file.randevu_tarihi && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[11px] text-slate-300">
                                      📅 {new Date(file.randevu_tarihi).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      daysLeft !== null && daysLeft <= 0 ? "bg-red-500/25 text-red-300" :
                                      daysLeft !== null && daysLeft <= 2 ? "bg-amber-500/25 text-amber-300" :
                                      "bg-blue-500/20 text-blue-300"
                                    }`}>
                                      {daysText}
                                    </span>
                                  </div>
                                )}

                                {/* Ödeme bilgisi */}
                                <div className="mt-1.5">
                                  <span className={`text-[10px] ${file.odeme_durumu === "Ödendi" ? "text-emerald-400" : "text-amber-400"}`}>
                                    {file.odeme_durumu === "Ödendi" ? "💰 Ödendi" : "⏳ Ödenmedi"}
                                    {file.ucret ? ` • ${file.ucret} ${file.ucret_currency}` : ""}
                                  </span>
                                </div>
                              </div>

                              {/* Detay Gör Butonu */}
                              <button
                                onClick={() => navigateToFile(file.id)}
                                className="w-full px-3 py-2 bg-primary-500/10 hover:bg-primary-500/20 border-t border-white/[0.06] text-primary-400 hover:text-primary-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Detay Gör
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className={`text-[9px] mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      msg.type === "user" ? "text-right text-slate-500" : "text-slate-600"
                    }`}>
                      {getTimeStr(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Kullanıcı Seçim Butonları */}
            {showUserPicker && userOptions.length > 0 && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500/30 to-violet-500/30 ring-1 ring-primary-500/20 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    📬
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {userOptions.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handlePickUser(u)}
                        className="flex items-center gap-2.5 bg-white/[0.06] hover:bg-primary-500/20 border border-white/[0.1] hover:border-primary-500/30 rounded-xl px-3.5 py-2.5 transition-all text-left group/user"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/40 to-violet-500/40 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover/user:from-primary-500/60 group-hover/user:to-violet-500/60 transition-all">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{u.name}</p>
                          <p className="text-[10px] text-slate-500">{u.role === "admin" ? "Yönetici" : "Personel"}</p>
                        </div>
                        <svg className="w-4 h-4 text-slate-600 group-hover/user:text-primary-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowUserPicker(false);
                        setMessages(prev => [...prev, {
                          id: Date.now().toString(),
                          type: "ai",
                          content: "Mesaj gönderme iptal edildi.",
                          timestamp: new Date(),
                        }]);
                      }}
                      className="text-[10px] text-slate-500 hover:text-red-400 transition-colors text-center py-1"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500/30 to-violet-500/30 ring-1 ring-primary-500/20 flex items-center justify-center text-[10px] flex-shrink-0 font-bold text-white">
                    V
                  </div>
                  <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending Message Banner */}
          {pendingMessage && (
            <div className="px-3 pb-1 flex-shrink-0">
              <div className="flex items-center justify-between bg-primary-500/20 rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-primary-300">✉️ {pendingMessage.receiverName}&apos;a mesaj yazılıyor...</span>
                <button
                  onClick={() => {
                    setPendingMessage(null);
                    setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      type: "ai",
                      content: "Mesaj iptal edildi.",
                      timestamp: new Date(),
                    }]);
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-2.5 border-t border-white/[0.06] flex-shrink-0 bg-white/[0.02]">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={pendingMessage ? "Mesajınızı yazın..." : "Bir şey sorun..."}
                className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-primary-500 to-violet-500 hover:from-primary-400 hover:to-violet-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl p-2.5 transition-all shadow-lg shadow-primary-500/20 disabled:shadow-none"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
