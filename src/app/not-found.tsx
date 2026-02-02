import Link from "next/link";

export default function NotFound() {
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
          padding: "40px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "72px",
            marginBottom: "16px",
          }}
        >
          🦊
        </div>
        <h1
          style={{
            fontSize: "80px",
            fontWeight: "800",
            color: "#f97316",
            margin: "0 0 8px 0",
            lineHeight: "1",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1e293b",
            marginBottom: "8px",
            marginTop: "0",
          }}
        >
          Sayfa Bulunamadı
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#64748b",
            marginBottom: "24px",
            lineHeight: "1.6",
          }}
        >
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            borderRadius: "8px",
            backgroundColor: "#f97316",
            color: "white",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
