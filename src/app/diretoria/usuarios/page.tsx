import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { todosOsUsuarios } from "@/lib/usuarios";
import { contarPendencias } from "@/lib/pendencias";
import { ListaUsuarios } from "./ListaUsuarios";

export const metadata: Metadata = { title: "Administração", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Área do administrador: contas, dados e o que está pendente no sistema. */
export default async function Usuarios() {
  await exigirAdmin();
  const supabase = await createClient();

  const [usuarios, pendencias, { count: aguardandoPagamento }] = await Promise.all([
    todosOsUsuarios(),
    contarPendencias(true),
    supabase
      .from("inscricoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_pagamento"),
  ]);

  return (
    <ListaUsuarios
      usuarios={usuarios}
      pendencias={{
        comprovantes: pendencias.comprovantes,
        emailsPendentes: usuarios.filter((u) => !u.emailConfirmado).length,
        aguardandoPagamento: aguardandoPagamento ?? 0,
      }}
    />
  );
}
