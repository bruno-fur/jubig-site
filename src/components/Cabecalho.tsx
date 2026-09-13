import Link from "next/link";
import { ehDiretoria, type Sessao } from "@/lib/sessao";
import { MenuConta } from "./MenuConta";
import { LinkNav } from "./LinkNav";

export async function Cabecalho({ sessao }: { sessao: Sessao | null }) {
  const diretoria = sessao ? await ehDiretoria(sessao.userId) : false;

  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-creme/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="JUBIG — início" className="shrink-0">
          {/* 1103x551 no arquivo; a altura fixa e a largura automática mantêm a proporção. */}
          <img
            src="/logo-jubig.png"
            alt="JUBIG — Juventude Batista do Iguaçu"
            width={220}
            height={110}
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {sessao ? (
            <>
              <LinkNav href="/minhas-inscricoes" className="rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta">
                Minhas inscrições
              </LinkNav>
              {diretoria && (
                <LinkNav href="/diretoria" className="rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta">
                  Diretoria
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
    </header>
  );
}
