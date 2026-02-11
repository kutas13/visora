"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Modal } from "@/components/ui";
import type { Company } from "@/lib/supabase/types";

export default function MuhasebeFirmalarPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.data || []);
      }
    } catch (err) {
      console.error("Firma listesi yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async () => {
    if (!newCompanyName.trim()) return;

    try {
      const res = await fetch("/api/companies", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_adi: newCompanyName.trim() }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewCompanyName("");
        loadCompanies(); // Listeyi yenile
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Hata: ${data.error || "Firma oluşturulamadı"}`);
      }
    } catch (err) {
      alert("Bağlantı hatası");
    }
  };

  const editCompany = async () => {
    if (!editingCompany || !newCompanyName.trim()) return;

    try {
      const res = await fetch(`/api/companies/${editingCompany.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_adi: newCompanyName.trim() }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setEditingCompany(null);
        setNewCompanyName("");
        loadCompanies(); // Listeyi yenile
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Hata: ${data.error || "Firma güncellenemedi"}`);
      }
    } catch (err) {
      alert("Bağlantı hatası");
    }
  };

  const filteredCompanies = companies.filter(c =>
    c.firma_adi.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur border-b border-white/20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Geri
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Firma Yönetimi</h1>
              <p className="text-sm text-white/60">{companies.length} firma kayıtlı</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-500 hover:bg-green-600 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Firma
          </Button>
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Arama */}
          <Card className="p-4 bg-white/10 backdrop-blur border border-white/20 mb-6">
            <Input
              placeholder="Firma adı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder-white/50"
            />
          </Card>

          {/* Firma Listesi */}
          <Card className="p-6 bg-white/10 backdrop-blur border border-white/20">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60">Firmalar alınıyor...</p>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {searchTerm ? "Firma bulunamadı" : "Henüz firma yok"}
                </h3>
                <p className="text-white/60 mb-4">
                  {searchTerm ? "Arama kriterinize uygun firma bulunamadı" : "Yeni firma oluşturmak için yukarıdaki butonu kullanın"}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    İlk Firmayı Oluştur
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompanies.map((company) => (
                  <div key={company.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{company.firma_adi}</h4>
                        <p className="text-xs text-white/50 mt-1">
                          {new Date(company.created_at).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingCompany(company);
                          setNewCompanyName(company.firma_adi);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-xs text-white/70">Firma ID: {company.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Firma Oluştur Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setNewCompanyName(""); }} title="Yeni Firma Oluştur" size="sm">
        <div className="space-y-4">
          <Input
            label="Firma Adı"
            placeholder="Firma adını girin..."
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
          />
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateModal(false);
                setNewCompanyName("");
              }}
              className="flex-1"
            >
              İptal
            </Button>
            <Button 
              onClick={createCompany}
              disabled={!newCompanyName.trim()}
              className="flex-1"
            >
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Firma Düzenle Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingCompany(null); setNewCompanyName(""); }} title="Firmayı Düzenle" size="sm">
        <div className="space-y-4">
          <Input
            label="Firma Adı"
            placeholder="Firma adını girin..."
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
          />
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditModal(false);
                setEditingCompany(null);
                setNewCompanyName("");
              }}
              className="flex-1"
            >
              İptal
            </Button>
            <Button 
              onClick={editCompany}
              disabled={!newCompanyName.trim()}
              className="flex-1"
            >
              Güncelle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}