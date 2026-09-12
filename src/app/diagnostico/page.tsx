import type { Metadata } from "next";
import { TabelaVariaveis, lerVariaveis } from "@/components/TabelaVariaveis";

export const metadata: Metadata = { title: "Diagnóstico", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Estado da configuração, acessível depois que o site já sobe.
 *
 * A tela `SemConfiguracao` só aparece quando falta o Supabase — e aí some,
 * levando junto a única forma de perceber que `GMAIL_SENHA_APP` ficou vazia.
 * Essa é a falha que não avisa: o site funciona inteiro e nenhum e-mail sai.
 */
export default function Diagnostico() {
  const faltando = lerVariaveis().filter((l) => l.obrigatoria && !l.tem);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Diagnóstico</h1>
      <p className="mt-2 text-apagado">
        Mostra só se cada variável tem valor, nunca o valor.
      </p>

      <div
        className={`mt-6 flex items-center gap-4 rounded-[16px] border p-5 ${
          faltando.length === 0 ? "border-ok/30 bg-ok/5" : "border-ruim/30 bg-ruim/5"
        }`}
      >
        <img
          src={faltando.length === 0 ? "/juca/joia.webp" : "/juca/nervoso.webp"}
          alt=""
          className="h-16 w-16 shrink-0 object-contain"
        />
        <p className="text-sm text-tinta">
          {faltando.length === 0
            ? "Todas as variáveis obrigatórias estão preenchidas."
            : `Sem valor: ${faltando.map((f) => f.nome).join(", ")}.`}
        </p>
      </div>

      <div className="cartao mt-6 overflow-x-auto p-5">
        <TabelaVariaveis />
      </div>

      <p className="mt-6 text-sm text-apagado">
        Variável nova só vale depois de um novo deploy — salvar na Vercel e recarregar a página não
        muda nada.
      </p>
      <p className="mt-2 font-mono text-xs text-apagado">
        build {process.env.BUILD_COMMIT} · {process.env.BUILD_EM?.replace("T", " ").slice(0, 16)} UTC
      </p>
    </div>
  );
}
