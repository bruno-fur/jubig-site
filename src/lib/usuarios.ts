import "server-only";
import type { User } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import type { Papel } from "@/tipos/db";

export type UsuarioGeral = {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
  igreja: string | null;
  criadoEm: string;
  ultimoAcesso: string | null;
  emailConfirmado: boolean;
  papel: Papel | null;
  inscricoes: number;
};

/**
 * Todas as contas, com perfil, papel e quantas inscrições cada uma fez.
 *
 * Service role de ponta a ponta: `auth.users` não é alcançável de outro jeito,
 * e a lista cruza dados de todo mundo. Só chamar depois de `exigirAdmin`.
 */
export async function todosOsUsuarios(): Promise<UsuarioGeral[]> {
  const admin = criarClienteAdmin();

  // listUsers pagina de 1000 em 1000; lê até acabar.
  const contas: User[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error(error.message);
    contas.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const [{ data: perfis }, { data: equipe }, { data: inscricoes }] = await Promise.all([
    admin.from("perfis").select("id, nome, telefone, igreja, email_confirmado_em"),
    admin.from("diretoria").select("user_id, papel"),
    admin.from("inscricoes").select("responsavel_id").neq("status", "cancelada"),
  ]);

  const perfil = new Map((perfis ?? []).map((p) => [p.id as string, p]));
  const papel = new Map((equipe ?? []).map((d) => [d.user_id as string, d.papel as Papel]));
  const contagem = new Map<string, number>();
  for (const i of inscricoes ?? []) {
    const id = i.responsavel_id as string;
    contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }

  return contas
    .map((u) => {
      const p = perfil.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        nome: (p?.nome as string) || (u.user_metadata?.nome as string) || "",
        telefone: (p?.telefone as string) ?? null,
        igreja: (p?.igreja as string) ?? null,
        criadoEm: u.created_at,
        ultimoAcesso: u.last_sign_in_at ?? null,
        emailConfirmado: Boolean(p?.email_confirmado_em),
        papel: papel.get(u.id) ?? null,
        inscricoes: contagem.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
