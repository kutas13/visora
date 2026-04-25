import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        padding: "16px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          padding: "44px 36px",
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "20px",
            backgroundColor: "#0f172a",
            color: "white",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "-0.05em",
            marginBottom: "20px",
          }}
        >
          V
        </div>
        <h1
          style={{
            fontSize: "72px",
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 8px 0",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 600,
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
            lineHeight: 1.6,
          }}
        >
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: "10px",
            backgroundColor: "#0f172a",
            color: "white",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
