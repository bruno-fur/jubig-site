import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { GerenciarEquipe } from "./GerenciarEquipe";
import type { MembroDiretoria, Papel } from "@/tipos/db";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe() {
  const sessao = await exigirAdmin();
  const supabase = await createClient();

  const { data: equipe } = await supabase.from("diretoria").select("user_id, papel");
  const ids = (equipe ?? []).map((e) => e.user_id as string);

  const { data: perfis } = await supabase.from("perfis").select("id, nome").in("id", ids);
  const nomes = new Map((perfis ?? []).map((p) => [p.id as string, p.nome as string]));

  /*
   * O e-mail mora em `auth.users`, fora do alcance da chave anônima — nem a
   * diretoria lê aquela tabela. Só o service role, e só aqui, para montar a
   * lista de quem tem acesso.
   */
  const admin = criarClienteAdmin();
  const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const membros: MembroDiretoria[] = (equipe ?? [])
    .map((e) => ({
      user_id: e.user_id as string,
      papel: e.papel as Papel,
      nome: nomes.get(e.user_id as string) || "(sem nome)",
      email: emails.get(e.user_id as string) ?? "",
    }))
    .sort((a, b) => (a.papel === b.papel ? a.nome.localeCompare(b.nome, "pt-BR") : a.papel === "admin" ? -1 : 1));

  return <GerenciarEquipe membros={membros} euId={sessao.userId} />;
}
