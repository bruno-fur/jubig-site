import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

export default async function proxy(req: NextRequest) {
  return atualizarSessao(req);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos arquivo estático e imagem — senão cada figurinha do Juca
     * dispara uma consulta de sessão à toa.
     */
    "/((?!_next/static|_next/image|favicon.ico|juca/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
