"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import type { Igreja } from "@/tipos/db";

const MENSAGEM: Record<string, string> = {
  tem_eventos: "Essa igreja já sediou um evento. Desative em vez de apagar, para não perder o histórico.",
  sem_permissao: "Só administrador mexe nas igrejas.",
  pedido_invalido: "Confira os campos.",
};

const vazio = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

/** "-24,7861" e "-24.7861" viram o mesmo número; vírgula é o que o teclado do celular dá. */
const numero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function GerenciarIgrejas({ igrejas }: { igrejas: Igreja[] }) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const [editando, setEditando] = useState<string | null>(null);

  async function enviar(ev: React.FormEvent<HTMLFormElement>, id?: string) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const dados = {
      ...(id && { id }),
      nome: String(f.get("nome") ?? ""),
      cidade: String(f.get("cidade") ?? ""),
      estado: String(f.get("estado") ?? "PR").toUpperCase(),
      endereco: vazio(f.get("endereco")),
      latitude: numero(f.get("latitude")),
      longitude: numero(f.get("longitude")),
      responsavel: vazio(f.get("responsavel")),
      instagram: vazio(f.get("instagram")),
      ativa: f.get("ativa") !== null,
      ordem: Number(f.get("ordem") ?? 0),
    };

    const { ok } = await acao.json("/api/admin/igrejas", id ? "PATCH" : "POST", dados);
    if (ok) {
      if (id) setEditando(null);
      else ev.currentTarget.reset();
    }
  }

  return (
    <>
      <div className="mb-4 empty:hidden">
        <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
      </div>

      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">Nova igreja</h2>
        <p className="mt-1 text-sm text-apagado">
          Sem latitude e longitude a igreja entra na lista, mas não no mapa. Para pegar: abra o
          Google Maps, toque e segure no ponto da igreja — ele mostra os dois números.
        </p>
        <Campos aoEnviar={enviar} ocupado={acao.ocupado} rotuloBotao="Adicionar" />
      </section>

      <ul className="cartao divide-y divide-linha">
        {igrejas.map((i) =>
          editando === i.id ? (
            <li key={i.id} className="p-5">
              <Campos
                igreja={i}
                ocupado={acao.ocupado}
                rotuloBotao="Salvar"
                aoEnviar={(e) => enviar(e, i.id)}
                aoCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <span className="min-w-0">
                <span className="block font-semibold text-tinta">
                  {i.nome}
                  {!i.ativa && <span className="font-normal text-apagado"> · desativada</span>}
                </span>
                <span className="block text-sm text-apagado">
                  {i.cidade} · {i.estado}
                  {i.endereco && ` · ${i.endereco}`}
                </span>
                <span className="block text-xs text-apagado">
                  {i.latitude !== null && i.longitude !== null
                    ? `no mapa (${i.latitude}, ${i.longitude})`
                    : "sem localização — não aparece no mapa"}
                </span>
              </span>

              <span className="flex shrink-0 gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setEditando(i.id)}
                  className="font-semibold text-laranja-escuro hover:underline"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={acao.ocupado}
                  onClick={() => acao.json("/api/admin/igrejas", "DELETE", { id: i.id })}
                  className="font-semibold text-ruim hover:underline disabled:opacity-40"
                >
                  Apagar
                </button>
              </span>
            </li>
          )
        )}
      </ul>

      {igrejas.length === 0 && (
        <div className="cartao flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhuma igreja cadastrada ainda.</p>
        </div>
      )}
    </>
  );
}

function Campos({
  igreja,
  ocupado,
  rotuloBotao,
  aoEnviar,
  aoCancelar,
}: {
  igreja?: Igreja;
  ocupado: boolean;
  rotuloBotao: string;
  aoEnviar: (e: React.FormEvent<HTMLFormElement>) => void;
  aoCancelar?: () => void;
}) {
  return (
    <form onSubmit={aoEnviar} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-1 block text-sm font-semibold text-tinta">Nome</span>
        <input name="nome" required defaultValue={igreja?.nome} className="campo-texto" />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold text-tinta">Cidade</span>
        <input name="cidade" required defaultValue={igreja?.cidade} className="campo-texto" />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold text-tinta">Estado</span>
        <input
          name="estado"
          maxLength={2}
          defaultValue={igreja?.estado ?? "PR"}
          className="campo-texto uppercase"
        />
      </label>

      <label className="sm:col-span-2">
        <span className="mb-1 block text-sm font-semibold text-tinta">Endereço</span>
        <input name="endereco" defaultValue={igreja?.endereco ?? ""} className="campo-texto" />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold text-tinta">Latitude</span>
        <input
          name="latitude"
          inputMode="decimal"
          placeholder="-24.4167"
          defaultValue={igreja?.latitude ?? ""}
          className="campo-texto"
        />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold text-tinta">Longitude</span>
        <input
          name="longitude"
          inputMode="decimal"
          placeholder="-53.5208"
          defaultValue={igreja?.longitude ?? ""}
          className="campo-texto"
        />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold text-tinta">Responsável</span>
        <input name="responsavel" defaultValue={igreja?.responsavel ?? ""} className="campo-texto" />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold text-tinta">Instagram</span>
        <input
          name="instagram"
          placeholder="sem o @"
          defaultValue={igreja?.instagram ?? ""}
          className="campo-texto"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-apagado">
        <input
          name="ativa"
          type="checkbox"
          defaultChecked={igreja?.ativa ?? true}
          className="h-4 w-4 accent-[#D94C1A]"
        />
        Aparece no site
      </label>

      <span className="flex gap-2 sm:justify-end">
        {aoCancelar && (
          <button type="button" onClick={aoCancelar} className="botao-secundario">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={ocupado} className="botao-primario">
          {ocupado ? (
            <>
              <Girando />
              Salvando...
            </>
          ) : (
            rotuloBotao
          )}
        </button>
      </span>
    </form>
  );
}
