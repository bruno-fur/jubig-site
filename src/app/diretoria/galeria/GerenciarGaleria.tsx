"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { comprimirImagem } from "@/lib/comprimir";
import { ondeFica, type Album } from "@/lib/galeria";

export type FotoDaGaleria = {
  id: string;
  legenda: string | null;
  albumId: string | null;
  eventoId: string | null;
  url: string;
};

type Evento = { id: string; nome: string };

const MENSAGEM: Record<string, string> = {
  tipo_invalido: "Aceita foto JPG, PNG ou WebP.",
  arquivo_grande: "A foto passa de 8 MB mesmo depois de reduzida.",
  falha_upload: "A foto não subiu. Tente de novo.",
  sem_permissao: "Só a diretoria mexe na galeria.",
  nao_encontrada: "Essa foto já tinha sido apagada.",
  pedido_invalido: "Confira o título e o link.",
  link_nao_e_pasta: "Esse link não é de uma pasta do Drive. Copie o link da pasta, não o de uma foto.",
  pasta_vazia_ou_privada:
    "Não consegui ler a pasta. No Drive, use Compartilhar e deixe como 'qualquer pessoa com o link'.",
  album_nao_encontrado: "Álbum não encontrado. Recarregue a página.",
};

/**
 * Galeria em álbuns.
 *
 * O site guarda a prévia — cinco ou seis fotos — e manda para o acervo
 * completo, que continua no Drive de quem fotografou. Mil fotos de congresso
 * estouram sozinhas o 1 GB do plano gratuito.
 *
 * Com link do Drive, dá para trazer as fotos automaticamente. Com qualquer
 * outro link (Instagram, Google Fotos), a prévia é enviada à mão.
 */
export function GerenciarGaleria({
  fotos,
  albuns,
  eventos,
  semTabela,
}: {
  fotos: FotoDaGaleria[];
  albuns: Album[];
  eventos: Evento[];
  semTabela: boolean;
}) {
  const router = useRouter();
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");
  const [data, setData] = useState("");
  const [eventoId, setEventoId] = useState("");

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await acao.json("/api/admin/albuns", "POST", {
      titulo,
      link: link || null,
      data: data || null,
      eventoId: eventoId || null,
      ordem: albuns.length,
    });
    if (ok) {
      setTitulo("");
      setLink("");
      setData("");
      setEventoId("");
    }
  }

  if (semTabela) {
    return (
      <p role="alert" className="rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
        A tabela de álbuns ainda não existe no banco. Rode o supabase/schema.sql no SQL Editor do
        Supabase e recarregue esta página.
      </p>
    );
  }

  const soltas = fotos.filter((f) => !f.albumId);

  return (
    <div className="space-y-8">
      <section className="cartao p-5">
        <h2 className="titulo text-xl">Novo álbum</h2>
        <p className="mt-1 text-sm text-apagado">
          O site mostra só algumas fotos e o botão que leva ao acervo completo, onde ele estiver.
        </p>

        <form onSubmit={criar} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">
                Título <span className="text-laranja">*</span>
              </span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Congresso de Carnaval 2023"
                required
                maxLength={120}
                className="campo-texto"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Link do acervo</span>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="campo-texto"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo-texto" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Evento (opcional)</span>
              <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="campo-texto">
                <option value="">Nenhum</option>
                {eventos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" disabled={acao.ocupado} className="botao-primario">
            {acao.ocupado ? (
              <>
                <Girando />
                Criando...
              </>
            ) : (
              "Criar álbum"
            )}
          </button>
        </form>

        {(acao.erro || acao.feito) && (
          <div className="mt-3">
            <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
          </div>
        )}
      </section>

      {albuns.map((a) => (
        <CartaoAlbum
          key={a.id}
          album={a}
          fotos={fotos.filter((f) => f.albumId === a.id)}
          aoMudar={() => router.refresh()}
        />
      ))}

      {albuns.length === 0 && (
        <div className="cartao flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhum álbum ainda. Crie o primeiro aí em cima.</p>
        </div>
      )}

      {soltas.length > 0 && (
        <section>
          <h2 className="titulo text-xl">Fotos sem álbum</h2>
          <p className="mt-1 text-sm text-apagado">
            Vieram de antes dos álbuns existirem. Apague ou deixe: elas aparecem em &quot;Outros
            momentos&quot; na galeria.
          </p>
          <Grade fotos={soltas} aoMudar={() => router.refresh()} />
        </section>
      )}
    </div>
  );
}

function CartaoAlbum({
  album,
  fotos,
  aoMudar,
}: {
  album: Album;
  fotos: FotoDaGaleria[];
  aoMudar: () => void;
}) {
  const acao = useAcao({ mensagens: MENSAGEM });
  const [fila, setFila] = useState<{ total: number; feitas: number } | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);

  const ehDrive = /drive\.google\.com\/drive\/folders/.test(album.link ?? "");

  async function importarDoDrive() {
    setErroLocal(null);
    const { ok, dados } = await acao.json("/api/admin/albuns/importar", "POST", {
      albumId: album.id,
      link: album.link,
      quantas: 5,
    });
    if (ok) setErroLocal(`${dados.fotos} fotos trazidas do Drive.`);
  }

  async function enviar(lista: FileList | null) {
    if (!lista?.length) return;
    setErroLocal(null);
    const arquivos = [...lista];
    setFila({ total: arquivos.length, feitas: 0 });

    let falhas = 0;
    for (const [i, bruto] of arquivos.entries()) {
      const { arquivo } = await comprimirImagem(bruto);
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      corpo.append("albumId", album.id);
      corpo.append("ordem", String(fotos.length + i));

      const r = await fetch("/api/admin/galeria", { method: "POST", body: corpo }).catch(() => null);
      if (!r?.ok) falhas++;
      setFila({ total: arquivos.length, feitas: i + 1 });
    }

    setFila(null);
    if (falhas > 0) setErroLocal(`${falhas} de ${arquivos.length} não subiram.`);
    aoMudar();
  }

  return (
    <section className="cartao p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="titulo text-xl">{album.titulo}</h2>
          <p className="text-sm text-apagado">
            {fotos.length} {fotos.length === 1 ? "foto de prévia" : "fotos de prévia"}
            {album.data && ` · ${new Date(`${album.data}T12:00:00`).toLocaleDateString("pt-BR")}`}
          </p>
          {album.link && (
            <a
              href={album.link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-laranja-escuro hover:underline"
            >
              {ondeFica(album.link)} ↗
            </a>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3 text-sm">
          {apagando ? (
            <>
              <button
                type="button"
                disabled={acao.ocupado}
                onClick={() => acao.json("/api/admin/albuns", "DELETE", { id: album.id })}
                className="font-semibold text-ruim hover:underline"
              >
                Apagar álbum e as {fotos.length} fotos
              </button>
              <button type="button" onClick={() => setApagando(false)} className="text-apagado hover:underline">
                Voltar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setApagando(true)} className="font-semibold text-ruim hover:underline">
              Apagar
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {ehDrive && (
          <button type="button" disabled={acao.ocupado} onClick={importarDoDrive} className="botao-secundario">
            {acao.ocupado ? (
              <>
                <Girando />
                Buscando no Drive...
              </>
            ) : (
              "Trazer 5 fotos do Drive"
            )}
          </button>
        )}

        <label className="botao-secundario cursor-pointer">
          Subir fotos do computador
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={Boolean(fila)}
            onChange={(e) => void enviar(e.target.files)}
            className="hidden"
          />
        </label>

        {fila && (
          <span className="flex items-center gap-2 text-sm font-semibold text-laranja-escuro" aria-live="polite">
            <Girando />
            Enviando {fila.feitas} de {fila.total}...
          </span>
        )}
      </div>

      {(erroLocal || acao.erro) && (
        <div className="mt-3">
          <Recado
            erro={acao.erro}
            sucesso={acao.erro ? null : erroLocal}
            aoFechar={() => {
              setErroLocal(null);
              acao.limpar();
            }}
          />
        </div>
      )}

      {fotos.length > 0 && <Grade fotos={fotos} aoMudar={aoMudar} />}
    </section>
  );
}

function Grade({ fotos, aoMudar }: { fotos: FotoDaGaleria[]; aoMudar: () => void }) {
  const acao = useAcao({ mensagens: MENSAGEM, recarregar: false });

  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {fotos.map((f) => (
        <li key={f.id} className="cartao overflow-hidden">
          <img src={f.url} alt={f.legenda ?? ""} loading="lazy" className="aspect-square w-full object-cover" />
          <div className="p-2">
            <input
              defaultValue={f.legenda ?? ""}
              placeholder="Legenda"
              maxLength={200}
              onBlur={(e) => {
                if (e.target.value === (f.legenda ?? "")) return;
                void acao.json("/api/admin/galeria", "PATCH", { id: f.id, legenda: e.target.value });
              }}
              className="w-full rounded-[8px] border border-linha px-2 py-1 text-xs"
            />
            <button
              type="button"
              disabled={acao.ocupado}
              onClick={async () => {
                await acao.json("/api/admin/galeria", "DELETE", { id: f.id });
                aoMudar();
              }}
              className="mt-1 text-xs font-semibold text-ruim hover:underline disabled:opacity-40"
            >
              Apagar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
