import Link from "next/link";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_DIRETORIA ?? "5545999999999";
const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM ?? "jubig.oficial";

export function Rodape() {
  return (
    <footer className="mt-16 border-t border-linha bg-tinta text-creme">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="titulo text-lg">
            JU<span className="text-laranja">BIG</span>
          </p>
          <p className="mt-2 text-sm text-creme/70">
            Juventude Batista do Iguaçu — jovens das igrejas batistas do oeste do Paraná.
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
