"use client";

import { useEffect, useRef, useState } from "react";
import { Juca, type EstadoJuca } from "./juca/Juca";
import { Girando } from "./Girando";
import { Recado } from "./Recado";
import { useAcao } from "@/lib/useAcao";
import { comprimirImagem, tamanhoLegivel } from "@/lib/comprimir";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** O que a API aceita receber. Foto grande passa disso, mas é comprimida antes. */
const MAX_ENVIO = 8 * 1024 * 1024;
/** Foto direto da câmera pode passar de 8 MB: aceita e encolhe no navegador. */
const MAX_FOTO = 25 * 1024 * 1024;

const MENSAGEM: Record<string, string> = {
  email_nao_confirmado: "Confirme seu e-mail antes de enviar o comprovante.",
  tipo_invalido: "Aceita foto (JPG, PNG, WebP) ou PDF.",
  arquivo_grande: "O arquivo passa de 8 MB.",
  inscricao_nao_encontrada: "Inscrição não encontrada.",
  parcela_invalida: "Essa parcela não existe nesta inscrição.",
  parcela_ja_enviada: "Essa parcela já tem comprovante em análise.",
  falha_upload: "O arquivo não subiu. Tente de novo.",
  inscricao_cancelada: "Esta inscrição foi cancelada.",
};

type Escolhido = { arquivo: File; previa: string | null; original: number };

export function EnvioComprovante({ codigo, parcela }: { codigo: string; parcela: number }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [escolhido, setEscolhido] = useState<Escolhido | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Comprovante enviado!" });

  /*
   * Só devolve a memória da prévia quando o componente sai. Criar e soltar a
   * URL acontece no evento de escolher o arquivo, não num efeito — efeito que
   * chama setState dispara render em cascata, e aqui não há nada externo para
   * sincronizar: a troca de arquivo é um clique.
   */
  useEffect(() => {
    return () => {
      if (escolhido?.previa) URL.revokeObjectURL(escolhido.previa);
    };
  }, [escolhido]);

  function trocar(novo: Escolhido | null) {
    if (escolhido?.previa) URL.revokeObjectURL(escolhido.previa);
    setEscolhido(novo);
  }

  /*
   * Prévia da imagem escolhida. Comprovante trocado é o erro mais comum aqui —
   * a pessoa manda o print errado da galeria e só descobre quando a diretoria
   * recusa, dias depois.
   *
   * A foto é encolhida antes de subir (ver `comprimirImagem`); PDF vai como veio.
   */
  async function escolher(f: File | null) {
    setErroLocal(null);
    acao.limpar();

    if (!f) return trocar(null);
    if (!TIPOS.includes(f.type)) {
      trocar(null);
      return setErroLocal("Aceita foto (JPG, PNG, WebP) ou PDF.");
    }

    const ehImagem = f.type.startsWith("image/");
    if (f.size > (ehImagem ? MAX_FOTO : MAX_ENVIO)) {
      trocar(null);
      return setErroLocal(
        ehImagem
          ? "Essa foto passa de 25 MB. Tire um print da tela do banco."
          : "O PDF passa de 8 MB."
      );
    }

    setPreparando(true);
    const { arquivo, original } = await comprimirImagem(f);
    setPreparando(false);

    if (arquivo.size > MAX_ENVIO) {
      trocar(null);
      return setErroLocal("Não deu para reduzir esse arquivo. Tire um print da tela do banco.");
    }

    trocar({
      arquivo,
      original,
      previa: arquivo.type.startsWith("image/") ? URL.createObjectURL(arquivo) : null,
    });
  }

  async function enviar() {
    if (!escolhido) return;
    const corpo = new FormData();
    corpo.append("arquivo", escolhido.arquivo);
    corpo.append("codigo", codigo);
    corpo.append("parcela", String(parcela));

    const { ok } = await acao.executar("/api/comprovantes", { method: "POST", body: corpo });
    if (ok) {
      trocar(null);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const erro = erroLocal ?? acao.erro;
  // "incompleto" é o nervoso: comprovante em análise / ainda faltando algo.
  const estado: EstadoJuca = erro ? "invalido" : escolhido ? "valido" : "incompleto";
  const encolheu = escolhido && escolhido.arquivo.size < escolhido.original;
  const ocupado = acao.ocupado || preparando;

  return (
    <section className="mt-6 cartao p-5" aria-busy={ocupado}>
      <h2 className="titulo text-xl">Enviar o comprovante</h2>
      <p className="mt-1 text-sm text-apagado">
        Foto ou PDF do comprovante do PIX. Só você e a diretoria conseguem abrir esse arquivo.
      </p>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={ocupado}
        onChange={(e) => void escolher(e.target.files?.[0] ?? null)}
        className="mt-4 block w-full rounded-[10px] border-2 border-dashed border-linha bg-areia/40 p-4 text-sm text-apagado file:mr-3 file:rounded-[10px] file:border-0 file:bg-tinta file:px-4 file:py-2 file:text-sm file:font-semibold file:text-creme disabled:opacity-50"
      />

      {escolhido?.previa && (
        <figure className="mt-3">
          <img
            src={escolhido.previa}
            alt="Prévia do comprovante escolhido"
            className="max-h-52 w-full rounded-[10px] border border-linha bg-areia object-contain"
          />
          <figcaption className="mt-1 text-xs text-apagado">
            Confira se é o comprovante certo antes de enviar.
            {encolheu && (
              <>
                {" "}
                A foto foi reduzida de {tamanhoLegivel(escolhido.original)} para{" "}
                {tamanhoLegivel(escolhido.arquivo.size)} — dá para ler igual.
              </>
            )}
          </figcaption>
        </figure>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Juca estado={estado} tamanho={52} />
        <p className={`flex-1 text-sm ${erro ? "font-medium text-ruim" : "text-apagado"}`}>
          {erro ??
            (preparando
              ? "Preparando a imagem..."
              : escolhido
                ? escolhido.arquivo.name
                : "Nenhum arquivo escolhido ainda.")}
        </p>
      </div>

      {acao.feito && (
        <div className="mt-3">
          <Recado sucesso={acao.feito} />
        </div>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={!escolhido || ocupado}
        className="botao-primario mt-4 w-full"
      >
        {ocupado ? (
          <>
            <Girando />
            {preparando ? "Preparando..." : acao.atualizando ? "Atualizando..." : "Enviando..."}
          </>
        ) : (
          "Enviar comprovante"
        )}
      </button>
    </section>
  );
}
