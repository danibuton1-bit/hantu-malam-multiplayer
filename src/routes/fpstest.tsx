import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";
export const Route = createFileRoute("/fpstest")({ ssr: false, head: () => ({ meta: [
  { title: "Uji Grafis Permainan - Hantu Malam" },
  { name: "description", content: "Uji tampilan 3D dan kinerja permainan Hantu Malam." },
  { property: "og:title", content: "Uji Grafis Permainan - Hantu Malam" },
  { property: "og:description", content: "Pemeriksaan grafis dan karakter 3D Hantu Malam." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: () => (
  <Game code="TEST" me="a" isHost startedAt={Date.now() - 4000} onBackToLobby={() => {}} onLeave={() => {}}
    players={[{ id: "a", nama: "Raka", username: "r", karakter: "raka", role: "hunter", status: "alive" }, { id: "b", nama: "Aisyah", username: "x", karakter: "aisyah", role: "ghost", status: "alive" }]} />) });
