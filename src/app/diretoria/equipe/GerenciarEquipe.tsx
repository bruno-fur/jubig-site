"use client";

import { useMemo, useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { ROTULO_PAPEL, type MembroDiretoria, type Papel } from "@/tipos/db";

type Candidato = {
  id: string;
  nome: string;
  email: string;
  igreja: string | null;
  emailConfirmado: boolean;
};

const MENSAGEM: Record<string, string> = {
  conta_nao_existe: "Essa conta não existe mais. Recarregue a página.",
  ultimo_admin: "Precisa sobrar pelo menos um administrador.",
  nao_remova_a_si: "Você não pode tirar o próprio acesso.",
  sem_permissao: "Só administrador mexe na equipe.",
  pedido_invalido: "Escolha uma pessoa da lista.",
};

const normal = (t: string) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Quem tem acesso ao painel, e com qual nível.
 *
 * Escolhe-se a pessoa numa lista das contas existentes, em vez de digitar o
 * e-mail: e-mail digitado errado dava "conta não encontrada" e ninguém sabia
 * se a pessoa não tinha conta ou se tinha uma letra trocada.
 */
export function GerenciarEquipe({
  membros,
  candidatos,
  euId,
}: {
  membros: MembroDiretoria[];
  candidatos: Candidato[];
  euId: string;
}) {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<Candidato | null>(null);
  const [papel, setPapel] = useState<Papel>("membro");
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Acesso atualizado." });
  const ocupado = acao.ocupado;

  const filtrados = useMemo(() => {
    const q = normal(busca.trim());
    const lista = q
      ? candidatos.filter((c) => [c.nome, c.email, c.igreja ?? ""].some((x) => normal(x).includes(q)))
      : candidatos;
    // Lista longa não ajuda ninguém: com a busca vazia, só as mais recentes.
    return lista.slice(0, 30);
  }, [busca, candidatos]);

  async function chamar(metodo: "POST" | "PATCH" | "DELETE", corpo: unknown) {
    const { ok } = await acao.json("/api/admin/equipe", metodo, corpo);
    return ok;
  }

  const admins = membros.filter((m) => m.papel === "admin").length;

  return (
    <>
      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">Dar acesso a alguém</h2>
        <p className="mt-1 text-sm text-apagado">
          Busque a pessoa entre as contas criadas no site e escolha o nível.
        </p>

        {escolhido ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border-2 border-laranja bg-laranja/5 p-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-tinta">{escolhido.nome}</span>
              <span className="block text-sm break-all text-apagado">{escolhido.email}</span>
            </span>
            <button
              type="button"
              onClick={() => setEscolhido(null)}
              className="text-sm font-semibold text-apagado hover:underline"
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, e-mail ou igreja"
              aria-label="Buscar conta"
              className="campo-texto mt-3"
            />
            <ul
              role="listbox"
              aria-label="Contas"
              className="mt-2 max-h-72 divide-y divide-linha overflow-y-auto rounded-[10px] border border-linha"
            >
              {filtrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => setEscolhido(c)}
                    className="w-full px-3 py-2 text-left hover:bg-areia focus-visible:bg-areia"
                  >
                    <span className="block text-sm font-semibold text-tinta">{c.nome}</span>
                    <span className="block text-xs break-all text-apagado">
                      {c.email}
                      {c.igreja && ` · ${c.igreja}`}
                      {!c.emailConfirmado && " · e-mail não confirmado"}
                    </span>
                  </button>
                </li>
              ))}
              {filtrados.length === 0 && (
                <li className="px-3 py-3 text-sm text-apagado">
                  {candidatos.length === 0
                    ? "Todas as contas já são da equipe."
                    : "Ninguém encontrado. A pessoa precisa ter criado conta no site."}
                </li>
              )}
            </ul>
          </>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            aria-label="Nível de acesso"
            className="campo-texto w-auto"
          >
            <option value="membro">Diretoria</option>
            <option value="admin">Administrador</option>
          </select>
          <button
            type="button"
            disabled={ocupado || !escolhido}
            onClick={async () => {
              if (escolhido && (await chamar("POST", { userId: escolhido.id, papel }))) {
                setEscolhido(null);
                setBusca("");
              }
            }}
            className="botao-primario"
          >
            {ocupado ? (
              <>
                <Girando />
                Salvando...
              </>
            ) : (
              "Dar acesso"
            )}
          </button>
        </div>

        <div className="mt-3 empty:hidden">
          <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
        </div>
      </section>

      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">O que cada nível pode</h2>
        <ul className="mt-2 space-y-2 text-sm text-apagado">
          <li>
            <strong className="text-tinta">Diretoria</strong> — confere comprovante, aprova,
            recusa, exporta a lista e faz a portaria.
          </li>
          <li>
            <strong className="text-tinta">Administrador</strong> — tudo isso, mais modalidades,
            igrejas, avisos, lista de usuários e dar acesso a outras pessoas.
          </li>
          <li>
            <strong className="text-tinta">Demais usuários</strong> — só as próprias inscrições.
            Não enxergam nada daqui.
          </li>
        </ul>
      </section>

      <ul className="cartao divide-y divide-linha">
        {membros.map((m) => {
          const euMesmo = m.user_id === euId;
          const ultimoAdmin = m.papel === "admin" && admins === 1;

          return (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block font-semibold text-tinta">
                  {m.nome}
                  {euMesmo && <span className="font-normal text-apagado"> · você</span>}
                </span>
                <span className="block text-sm break-all text-apagado">{m.email}</span>
              </span>

              <span className="flex shrink-0 items-center gap-3">
                <select
                  value={m.papel}
                  disabled={ocupado || ultimoAdmin}
                  title={ultimoAdmin ? "Precisa sobrar um administrador" : undefined}
                  onChange={(e) => chamar("PATCH", { userId: m.user_id, papel: e.target.value })}
                  aria-label={`Nível de ${m.nome}`}
                  className="rounded-[10px] border-2 border-linha bg-white px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="membro">{ROTULO_PAPEL.membro}</option>
                  <option value="admin">{ROTULO_PAPEL.admin}</option>
                </select>

                <button
                  type="button"
                  disabled={ocupado || euMesmo || ultimoAdmin}
                  onClick={() => chamar("DELETE", { userId: m.user_id })}
                  className="text-sm font-semibold text-ruim hover:underline disabled:opacity-40 disabled:hover:no-underline"
                >
                  Remover
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
