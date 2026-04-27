import type { Metadata } from "next";
import LandingClient from "./landing-client";

export const metadata: Metadata = {
  title: "Visora — Vize ofisleri için modern yönetim platformu",
  description:
    "Visora, vize ofisleri için dosya, müşteri, randevu, tahsilat ve raporlama süreçlerini tek panelde yönetir.",
};

export default function LandingPage() {
  return <LandingClient />;
}
