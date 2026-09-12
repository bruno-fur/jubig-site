"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Juca, type EstadoJuca } from "./juca/Juca";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 8 * 1024 * 1024;

export function EnvioComprovante({ codigo, parcela }: { codigo: string; parcela: number }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function escolher(f: File | null) {
    setErro(null);
    if (!f) return setArquivo(null);
    if (!TIPOS.includes(f.type)) {
      setArquivo(null);
      return setErro("Aceita foto (JPG, PNG, WebP) ou PDF.");
    }
    if (f.size > MAX) {
      setArquivo(null);
      return setErro("O arquivo passa de 8 MB. Tire um print ou reduza a foto.");
    }
    setArquivo(f);
  }

  async function enviar() {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);

    const corpo = new FormData();
    corpo.append("arquivo", arquivo);
    corpo.append("codigo", codigo);
    corpo.append("parcela", String(parcela));

    const r = await fetch("/api/comprovantes", { method: "POST", body: corpo });
    const dados = await r.json().catch(() => ({}));
    setEnviando(false);

    if (!r.ok) {
      setErro(
        {
          email_nao_confirmado: "Confirme seu e-mail antes de enviar o comprovante.",
          tipo_invalido: "Aceita foto (JPG, PNG, WebP) ou PDF.",
          arquivo_grande: "O arquivo passa de 8 MB.",
          inscricao_nao_encontrada: "Inscrição não encontrada.",
          parcela_invalida: "Essa parcela não existe nesta inscrição.",
          parcela_ja_enviada: "Essa parcela já tem comprovante em análise.",
        }[dados.erro as string] ?? "Não deu para enviar agora. Tente de novo."
      );
      return;
    }

    setArquivo(null);
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  // "incompleto" é o nervoso: comprovante em análise / ainda faltando algo.
  const estado: EstadoJuca = erro ? "invalido" : arquivo ? "valido" : "incompleto";

  return (
    <section className="mt-6 cartao p-5">
      <h2 className="titulo text-xl">Enviar o comprovante</h2>
      <p className="mt-1 text-sm text-apagado">
        Foto ou PDF do comprovante do PIX. Só você e a diretoria conseguem abrir esse arquivo.
      </p>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => escolher(e.target.files?.[0] ?? null)}
        className="mt-4 block w-full rounded-[10px] border-2 border-dashed border-linha bg-areia/40 p-4 text-sm text-apagado file:mr-3 file:rounded-[10px] file:border-0 file:bg-tinta file:px-4 file:py-2 file:text-sm file:font-semibold file:text-creme"
      />

      <div className="mt-4 flex items-center gap-3">
        <Juca estado={estado} tamanho={52} />
        <p className={`flex-1 text-sm ${erro ? "font-medium text-ruim" : "text-apagado"}`}>
          {erro ?? (arquivo ? arquivo.name : "Nenhum arquivo escolhido ainda.")}
        </p>
      </div>

      <button
        type="button"
        onClick={enviar}
        disabled={!arquivo || enviando}
        className="botao-primario mt-4 w-full"
      >
        {enviando ? "Enviando..." : "Enviar comprovante"}
      </button>
    </section>
  );
}
