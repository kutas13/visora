"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <head>
        <title>Hata - Visora</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
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
                width: "72px",
                height: "72px",
                backgroundColor: "#fef2f2",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "32px",
              }}
            >
              🔴
            </div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#dc2626",
                marginBottom: "8px",
                marginTop: "0",
              }}
            >
              Kritik Hata
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "24px",
                lineHeight: "1.6",
              }}
            >
              Uygulama yüklenirken kritik bir hata oluştu. Sayfayı yenilemeyi deneyin.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
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
                }}
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
