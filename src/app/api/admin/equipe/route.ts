import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { pegarSessao, papelDe } from "@/lib/sessao";

const Papel = z.enum(["admin", "membro"]);

async function exigirAdminNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "nao_autenticado" }, { status: 401 }) };
  if ((await papelDe(sessao.userId)) !== "admin")
    return { erro: NextResponse.json({ erro: "sem_permissao" }, { status: 403 }) };
  return { sessao };
}

/** O trigger do banco devolve 'ultimo_admin'; aqui vira 409 com nome. */
function traduzir(msg: string) {
  if (/ultimo_admin/i.test(msg)) return { corpo: { erro: "ultimo_admin" }, status: 409 };
  if (/row-level security/i.test(msg)) return { corpo: { erro: "sem_permissao" }, status: 403 };
  console.error("[equipe] erro inesperado", msg);
  return { corpo: { erro: "falha_ao_gravar" }, status: 400 };
}

/** Adiciona alguém à equipe pelo e-mail da conta que a pessoa já criou. */
export async function POST(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = z
    .object({ email: z.email(), papel: Papel.default("membro") })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const email = corpo.data.email.trim().toLowerCase();

  /*
   * Achar o usuário pelo e-mail exige service role: `auth.users` não é
   * alcançável pela chave anônima, nem para a diretoria.
   *
   * A pessoa precisa ter criado a conta antes. Convidar quem ainda não existe
   * significaria criar usuário sem senha, e aí o acesso da diretoria passaria
   * a depender de um fluxo de convite que ninguém pediu.
   */
  const admin = criarClienteAdmin();
  const { data: lista, error: erroBusca } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (erroBusca) {
    console.error("[equipe] listUsers falhou", erroBusca.message);
    return NextResponse.json({ erro: "falha_ao_buscar" }, { status: 500 });
  }

  const usuario = lista.users.find((u) => u.email?.toLowerCase() === email);
  if (!usuario) return NextResponse.json({ erro: "conta_nao_existe" }, { status: 404 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("diretoria")
    .upsert({ user_id: usuario.id, papel: corpo.data.papel });

  if (error) {
    const { corpo: c, status } = traduzir(error.message);
    return NextResponse.json(c, { status });
  }
  return NextResponse.json({ status: "ok" });
}

export async function PATCH(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = z
    .object({ userId: z.uuid(), papel: Papel })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("diretoria")
    .update({ papel: corpo.data.papel })
    .eq("user_id", corpo.data.userId);

  if (error) {
    const { corpo: c, status } = traduzir(error.message);
    return NextResponse.json(c, { status });
  }
  return NextResponse.json({ status: "ok" });
}

export async function DELETE(req: Request) {
  const { sessao, erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = z.object({ userId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  // Sair sozinho da equipe é quase sempre engano; o trigger só protege o
  // último admin, e um penúltimo poderia se remover sem perceber.
  if (corpo.data.userId === sessao!.userId)
    return NextResponse.json({ erro: "nao_remova_a_si" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("diretoria").delete().eq("user_id", corpo.data.userId);

  if (error) {
    const { corpo: c, status } = traduzir(error.message);
    return NextResponse.json(c, { status });
  }
  return NextResponse.json({ status: "ok" });
}
