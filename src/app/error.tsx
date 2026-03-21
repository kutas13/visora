"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (safe operation)
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f1f5f9",
        padding: "16px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
          padding: "32px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            backgroundColor: "#fef2f2",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: "28px",
          }}
        >
          ⚠️
        </div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#1e293b",
            marginBottom: "8px",
            marginTop: "0",
          }}
        >
          Bir Hata Oluştu
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#64748b",
            marginBottom: "24px",
            lineHeight: "1.5",
          }}
        >
          Sayfa yüklenirken bir sorun oluştu. Lütfen tekrar deneyin veya ana sayfaya dönün.
        </p>
        <p style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "24px", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", textAlign: "left", wordBreak: "break-all" }}>
          {error?.message || "Bilinmeyen hata"}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "white",
              color: "#475569",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Ana Sayfa
          </button>
          <button
            onClick={() => reset()}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#f97316",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    </div>
  );
}
