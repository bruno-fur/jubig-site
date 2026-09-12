import Link from "next/link";
import { ehDiretoria, type Sessao } from "@/lib/sessao";
import { MenuConta } from "./MenuConta";

export async function Cabecalho({ sessao }: { sessao: Sessao | null }) {
  const diretoria = sessao ? await ehDiretoria(sessao.userId) : false;

  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-creme/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="titulo text-xl text-tinta">
          JU<span className="text-laranja">BIG</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {sessao ? (
            <>
              <Link
                href="/minhas-inscricoes"
                className="rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta"
              >
                Minhas inscrições
              </Link>
              {diretoria && (
                <Link
                  href="/diretoria"
                  className="rounded-[10px] px-3 py-2 font-medium text-apagado hover:bg-areia hover:text-tinta"
                >
                  Diretoria
                </Link>
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
