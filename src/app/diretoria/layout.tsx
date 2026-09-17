import { AbasDiretoria, type AbaDiretoria } from "@/components/AbasDiretoria";
import { exigirDiretoria } from "@/lib/sessao";
import { ROTULO_PAPEL } from "@/tipos/db";

/**
 * Casca das telas da diretoria.
 *
 * O guard mora aqui, e não em cada página: assim uma tela nova criada mais
 * tarde nasce protegida em vez de depender de alguém lembrar de chamar
 * `exigirDiretoria()` nela.
 *
 * As abas de admin não aparecem para membro. Isso é conveniência da tela — a
 * recusa de verdade está na RLS e em `exigirAdmin()`; esconder link nunca foi
 * controle de acesso.
 */
export default async function LayoutDiretoria({ children }: { children: React.ReactNode }) {
  const sessao = await exigirDiretoria();
  const admin = sessao.papel === "admin";

  // Membro vê só o dia a dia; a administração é do admin. A recusa de verdade
  // continua em exigirAdmin() e na RLS — esconder o link não é controle de acesso.
  const abas: AbaDiretoria[] = (
    [
      { href: "/diretoria", titulo: "Visão geral", grupo: "dia" },
      { href: "/diretoria/inscricoes", titulo: "Inscrições", grupo: "dia" },
      { href: "/diretoria/pagamentos", titulo: "Pagamentos", grupo: "dia" },
      // Eventos fica no dia a dia: dentro de cada um, a diretoria toda cuida das
      // pulseiras. Criar e editar o evento continua só do admin.
      { href: "/diretoria/eventos", titulo: "Eventos", grupo: "dia" },
      { href: "/diretoria/galeria", titulo: "Galeria", grupo: "dia" },
      {
        href: "/diretoria/validacao",
        titulo: "Validação",
        grupo: "dia",
        tambem: ["/diretoria/ingresso", "/diretoria/portaria"],
      },
      { href: "/diretoria/modalidades", titulo: "Modalidades", grupo: "admin" },
      { href: "/diretoria/avisos", titulo: "Avisos", grupo: "admin" },
      { href: "/diretoria/igrejas", titulo: "Igrejas", grupo: "admin" },
      { href: "/diretoria/site", titulo: "Site", grupo: "admin" },
      { href: "/diretoria/usuarios", titulo: "Usuários", grupo: "admin" },
      { href: "/diretoria/equipe", titulo: "Equipe", grupo: "admin" },
    ] satisfies AbaDiretoria[]
  ).filter((a) => admin || a.grupo === "dia");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl">Diretoria</h1>
        <p className="text-sm text-apagado">
          {sessao.nome ?? sessao.email} · {ROTULO_PAPEL[sessao.papel]}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <AbasDiretoria abas={abas} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
