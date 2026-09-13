import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { todosOsUsuarios } from "@/lib/usuarios";
import { GerenciarEquipe } from "./GerenciarEquipe";
import type { MembroDiretoria } from "@/tipos/db";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function Equipe() {
  const sessao = await exigirAdmin();
  const usuarios = await todosOsUsuarios();

  const membros: MembroDiretoria[] = usuarios
    .filter((u) => u.papel)
    .map((u) => ({ user_id: u.id, papel: u.papel!, nome: u.nome || "(sem nome)", email: u.email }))
    .sort((a, b) =>
      a.papel === b.papel ? a.nome.localeCompare(b.nome, "pt-BR") : a.papel === "admin" ? -1 : 1
    );

  // Quem pode receber acesso: toda conta que ainda não é da equipe.
  const candidatos = usuarios
    .filter((u) => !u.papel)
    .map((u) => ({
      id: u.id,
      nome: u.nome || "(sem nome)",
      email: u.email,
      igreja: u.igreja,
      emailConfirmado: u.emailConfirmado,
    }));

  return <GerenciarEquipe membros={membros} candidatos={candidatos} euId={sessao.userId} />;
}
