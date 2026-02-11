"use client";

import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import VisaFileForm from "@/components/files/VisaFileForm";

export default function NewVisaFilePage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/app/files");
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Geri
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Yeni Vize Dosyası</h1>
          <p className="text-navy-500">Müşteri bilgilerini girin ve dosyayı oluşturun</p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6 max-w-4xl mx-auto">
        <VisaFileForm 
          file={null} 
          onSuccess={handleSuccess} 
          onCancel={handleCancel} 
        />
      </Card>
    </div>
  );
}