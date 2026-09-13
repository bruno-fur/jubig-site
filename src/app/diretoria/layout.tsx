import { LinkNav } from "@/components/LinkNav";
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

  const abas = [
    { href: "/diretoria", titulo: "Visão geral", soAdmin: false },
    { href: "/diretoria/inscricoes", titulo: "Inscrições", soAdmin: false },
    { href: "/diretoria/portaria", titulo: "Portaria", soAdmin: false },
    { href: "/diretoria/avisos", titulo: "Avisos", soAdmin: true },
    { href: "/diretoria/modalidades", titulo: "Modalidades", soAdmin: true },
    { href: "/diretoria/igrejas", titulo: "Igrejas", soAdmin: true },
    { href: "/diretoria/usuarios", titulo: "Usuários", soAdmin: true },
    { href: "/diretoria/equipe", titulo: "Equipe", soAdmin: true },
  ].filter((a) => admin || !a.soAdmin);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl">Diretoria</h1>
        <p className="text-sm text-apagado">
          {sessao.nome ?? sessao.email} · {ROTULO_PAPEL[sessao.papel]}
        </p>
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-linha">
        {abas.map((a) => (
          <LinkNav key={a.href} href={a.href} className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-apagado transition hover:border-laranja/40 hover:text-tinta">
            {a.titulo}
          </LinkNav>
        ))}
      </nav>

      <div className="pt-6">{children}</div>
    </div>
  );
}
