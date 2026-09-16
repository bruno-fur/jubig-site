import Link from "next/link";
import { papelDe, type Sessao } from "@/lib/sessao";
import { contarPendencias } from "@/lib/pendencias";
import { MenuConta } from "./MenuConta";
import { LinkNav } from "./LinkNav";
import { AvisoPendencias } from "./AvisoPendencias";

export async function Cabecalho({ sessao }: { sessao: Sessao | null }) {
  const papel = sessao ? await papelDe(sessao.userId) : null;
  // Aviso de pendência é da diretoria: usuário comum não gasta essa consulta.
  const pendencias = papel ? await contarPendencias(papel === "admin") : null;

  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-creme/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label="JUBIG — início" className="shrink-0">
          {/* 1103x551 no arquivo; a altura fixa e a largura automática mantêm a proporção. */}
          <img
            src="/logo-jubig.png"
            alt="JUBIG — Juventude Batista do Iguaçu"
            width={220}
            height={110}
            className="h-9 w-auto sm:h-10 lg:h-12"
          />
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {/* Aba pública: aparece logada ou não. */}
          <LinkNav
            href="/galeria"
            className="link-menu hidden rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta sm:inline-flex"
          >
            Galeria
          </LinkNav>

          {sessao ? (
            <>
              <LinkNav
                href="/minhas-inscricoes"
                className="link-menu rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta"
              >
                Minhas inscrições
              </LinkNav>
              {papel && (
                <LinkNav
                  href="/diretoria"
                  className="link-menu rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta"
                >
                  Diretoria
                  {pendencias && pendencias.comprovantes > 0 && (
                    <span
                      aria-label={`${pendencias.comprovantes} comprovantes para aprovar`}
                      className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-laranja px-1.5 text-[11px] leading-5 font-bold text-white"
                    >
                      {pendencias.comprovantes > 99 ? "99+" : pendencias.comprovantes}
                    </span>
                  )}
                </LinkNav>
              )}
              <MenuConta email={sessao.email} nome={sessao.nome} />
            </>
          ) : (
            <>
              <Link
                href="/entrar"
                className="rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta"
              >
                Entrar
              </Link>
              <Link href="/criar-conta" className="botao-primario px-4 py-2 text-sm">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>

      {pendencias && <AvisoPendencias comprovantes={pendencias.comprovantes} />}
    </header>
  );
}
