export type Album = {
  id: string;
  titulo: string;
  /** Acervo completo fora do site: Drive, Google Fotos, Instagram. */
  link: string | null;
  data: string | null;
  eventoId: string | null;
  ordem: number;
};

export type LinhaGaleria = {
  id: string;
  caminho: string;
  legenda: string | null;
  evento_id?: string | null;
  album_id?: string | null;
  /** Texto solto de antes da tabela de álbuns. */
  album?: string | null;
  ordem?: number;
};

export type Foto = {
  id: string;
  url: string;
  legenda: string | null;
};

/**
 * Nome do álbum da foto, na ordem em que a informação é confiável:
 * o álbum cadastrado, depois o evento, depois o texto solto e, por último, o
 * prefixo da legenda ("Congresso 2023 — Abertura").
 *
 * Os dois últimos casos existem para o site funcionar antes de o schema novo
 * rodar e para não perder o que já estava cadastrado.
 */
export function tituloDoAlbum(
  f: LinhaGaleria,
  albuns: Map<string, Album>,
  eventos: Map<string, { nome: string; data: string }>
): string | null {
  if (f.album_id) return albuns.get(f.album_id)?.titulo ?? null;
  if (f.evento_id) return eventos.get(f.evento_id)?.nome ?? null;
  if (f.album) return f.album;

  const separador = f.legenda?.indexOf(" — ") ?? -1;
  return separador > 0 ? f.legenda!.slice(0, separador) : null;
}

/** A legenda sem o nome do álbum na frente. */
export function legendaDaFoto(f: LinhaGaleria): string | null {
  if (f.album_id || f.album || !f.legenda) return f.legenda ?? null;
  const separador = f.legenda.indexOf(" — ");
  return separador > 0 ? f.legenda.slice(separador + 3) : f.legenda;
}

/** "abrir no Google Drive", "ver no Instagram" — o texto do botão do acervo. */
export function ondeFica(link: string | null): string | null {
  if (!link) return null;
  if (/drive\.google/.test(link)) return "Ver todas no Google Drive";
  if (/photos\.(google|app\.goo)/.test(link)) return "Ver todas no Google Fotos";
  if (/instagram/.test(link)) return "Ver todas no Instagram";
  if (/facebook/.test(link)) return "Ver todas no Facebook";
  return "Ver todas as fotos";
}
