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

/** Dá acesso a uma conta escolhida na lista. */
export async function POST(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = z
    .object({ userId: z.uuid(), papel: Papel.default("membro") })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  // A lista da tela pode estar velha: confere que a conta ainda existe.
  const admin = criarClienteAdmin();
  const { data: conta } = await admin.auth.admin.getUserById(corpo.data.userId);
  if (!conta?.user) return NextResponse.json({ erro: "conta_nao_existe" }, { status: 404 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("diretoria")
    .upsert({ user_id: corpo.data.userId, papel: corpo.data.papel });

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
