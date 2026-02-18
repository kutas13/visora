"use client";

import { useRouter } from "next/navigation";
import VisaFileForm from "@/components/files/VisaFileForm";

export default function NewVisaFilePage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-lg bg-navy-100 hover:bg-navy-200 flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-navy-900">Yeni Vize Dosyası</h1>
          <p className="text-navy-500 text-sm">Müşteri bilgilerini girin ve dosyayı oluşturun</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-navy-200 shadow-sm p-6 md:p-8">
        <VisaFileForm
          file={null}
          onSuccess={() => router.push("/app/files")}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
