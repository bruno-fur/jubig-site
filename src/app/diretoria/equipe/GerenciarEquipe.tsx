"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { ROTULO_PAPEL, type MembroDiretoria, type Papel } from "@/tipos/db";

const MENSAGEM: Record<string, string> = {
  conta_nao_existe:
    "Ninguém com esse e-mail criou conta no site ainda. Peça para a pessoa se cadastrar primeiro.",
  ultimo_admin: "Precisa sobrar pelo menos um administrador.",
  nao_remova_a_si: "Você não pode tirar o próprio acesso.",
  sem_permissao: "Só administrador mexe na equipe.",
  pedido_invalido: "Confira o e-mail.",
};

/**
 * Quem tem acesso ao painel, e com qual nível.
 *
 * Adicionar é por e-mail de conta já existente. Convidar quem ainda não se
 * cadastrou exigiria criar usuário sem senha e um fluxo de convite inteiro —
 * a pessoa cria a conta pelo site, como todo mundo, e aí entra na lista.
 */
export function GerenciarEquipe({
  membros,
  euId,
}: {
  membros: MembroDiretoria[];
  euId: string;
}) {
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("membro");
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Acesso atualizado." });
  const ocupado = acao.ocupado;

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
          A pessoa precisa ter criado a conta no site antes.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await chamar("POST", { email, papel })) setEmail("");
          }}
          className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_auto]"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@da.pessoa"
            className="campo-texto"
          />
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            className="campo-texto"
          >
            <option value="membro">Diretoria</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="submit" disabled={ocupado} className="botao-primario">
            {ocupado ? (
              <>
                <Girando />
                Salvando...
              </>
            ) : (
              "Dar acesso"
            )}
          </button>
        </form>

        <div className="mt-3 empty:hidden">
          <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
        </div>
      </section>

      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">O que cada nível pode</h2>
        <ul className="mt-2 space-y-2 text-sm text-apagado">
          <li>
            <strong className="text-tinta">Diretoria</strong> — confere comprovante, aprova,
            recusa e exporta a lista.
          </li>
          <li>
            <strong className="text-tinta">Administrador</strong> — tudo isso, mais criar e apagar
            modalidades, mexer no evento e dar acesso a outras pessoas.
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
                <span className="block text-sm text-apagado">{m.email}</span>
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
