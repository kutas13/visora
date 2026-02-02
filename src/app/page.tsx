import { redirect } from "next/navigation";

// Ana sayfa login'e yönlendirir
export default function Home() {
  redirect("/login");
}
