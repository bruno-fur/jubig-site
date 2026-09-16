import Link from "next/link";
import { lerConfiguracoes } from "@/lib/configuracoes";

/** Contatos vêm de Diretoria > Site. */
export async function Rodape() {
  const { whatsapp: WHATSAPP, instagram: INSTAGRAM } = await lerConfiguracoes();

  return (
    <footer className="mt-16 border-t border-linha bg-tinta text-creme print:hidden">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8 lg:py-14">
        <div>
          {/* Versão branca: o rodapé é escuro e a laranja some no fundo tinta. */}
          <img
            src="/logo-jubig-branco.png"
            alt="JUBIG"
            width={220}
            height={110}
            className="h-10 w-auto"
          />
          <p className="mt-3 text-sm text-creme/70">
            Juventude Batista do Iguaçu
          </p>
        </div>

        <nav className="text-sm">
          <p className="mb-2 font-semibold">Site</p>
          <ul className="space-y-1 text-creme/70">
            <li>
              <Link href="/" className="hover:text-laranja">
                Início
              </Link>
            </li>
            <li>
              <Link href="/minhas-inscricoes" className="hover:text-laranja">
                Minhas inscrições
              </Link>
            </li>
            <li>
              <Link href="/entrar" className="hover:text-laranja">
                Entrar
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="mb-2 font-semibold">Falar com a gente</p>
          <ul className="space-y-1 text-creme/70">
            <li>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                className="hover:text-laranja"
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp da diretoria
              </a>
            </li>
            <li>
              <a
                href={`https://instagram.com/${INSTAGRAM}`}
                className="hover:text-laranja"
                target="_blank"
                rel="noreferrer"
              >
                @{INSTAGRAM}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-creme/50">
        JUBIG · {new Date().getFullYear()}
      </div>
    </footer>
  );
}
