"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatarTelefone } from "@/lib/validacao";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { ROTULO_PAPEL } from "@/tipos/db";
import type { UsuarioGeral } from "@/lib/usuarios";

type Filtro = "todos" | "pendentes" | "com_inscricao" | "sem_inscricao" | "equipe" | "nunca_entrou";

type Pendencias = { comprovantes: number; emailsPendentes: number; aguardandoPagamento: number };

const MENSAGEM: Record<string, string> = {
  ja_confirmado: "Essa conta já estava confirmada.",
  muitas_tentativas: "Já foi enviado um link há menos de 1 minuto. Espere um pouco.",
  falha_envio: "O e-mail não saiu. Confira a senha de app do Gmail em Diagnóstico.",
  sem_permissao: "Só administrador faz isso.",
};

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "nunca";

/** Tira acento para "joao" achar "João". */
const normal = (t: string) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Área do administrador: todas as contas, dados e pendências.
 *
 * Lista de dado pessoal de jovens a partir de 12 anos: só admin enxerga, nada
 * fica em cache, e não há exportação daqui — o CSV de inscritos já cobre o que
 * a diretoria precisa operar.
 */
export function ListaUsuarios({ usuarios, pendencias }: { usuarios: UsuarioGeral[]; pendencias: Pendencias }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const acao = useAcao({ mensagens: MENSAGEM });
  const [feito, setFeito] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const q = normal(busca.trim());
    return usuarios.filter((u) => {
      if (filtro === "pendentes" && u.emailConfirmado) return false;
      if (filtro === "com_inscricao" && u.inscricoes === 0) return false;
      if (filtro === "sem_inscricao" && u.inscricoes > 0) return false;
      if (filtro === "equipe" && !u.papel) return false;
      if (filtro === "nunca_entrou" && u.ultimoAcesso) return false;
      if (!q) return true;
      return [u.nome, u.email, u.igreja ?? "", u.telefone ?? ""].some((c) => normal(c).includes(q));
    });
  }, [usuarios, busca, filtro]);

  async function agir(u: UsuarioGeral, tipo: "reenviar_confirmacao" | "confirmar_email") {
    setFeito(null);
    const { ok } = await acao.json("/api/admin/usuarios", "POST", { userId: u.id, acao: tipo });
    setConfirmandoId(null);
    if (ok)
      setFeito(
        tipo === "confirmar_email"
          ? `E-mail de ${u.nome || u.email} confirmado. A pessoa já pode se inscrever.`
          : `Link de confirmação reenviado para ${u.email}.`
      );
  }

  const total = usuarios.length;

  return (
    <>
      <section aria-labelledby="titulo-pendencias">
        <h2 id="titulo-pendencias" className="titulo text-xl">
          Pendências do sistema
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Pendencia
            numero={pendencias.comprovantes}
            rotulo="comprovantes para aprovar"
            href="/diretoria/inscricoes?status=pendente_analise"
            acaoTexto="Analisar"
          />
          <Pendencia
            numero={pendencias.emailsPendentes}
            rotulo="contas sem e-mail confirmado"
            aoClicar={() => setFiltro("pendentes")}
            acaoTexto="Ver contas"
          />
          <Pendencia
            numero={pendencias.aguardandoPagamento}
            rotulo="inscrições aguardando pagamento"
            href="/diretoria/inscricoes?status=aguardando_pagamento"
            acaoTexto="Ver inscrições"
          />
        </div>
      </section>

      <h2 className="titulo mt-8 text-xl">Contas</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, igreja ou telefone"
          aria-label="Buscar usuário"
          className="campo-texto min-w-0 flex-1"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          aria-label="Filtrar"
          className="campo-texto w-auto"
        >
          <option value="todos">Todas</option>
          <option value="pendentes">E-mail não confirmado</option>
          <option value="com_inscricao">Com inscrição</option>
          <option value="sem_inscricao">Sem inscrição</option>
          <option value="nunca_entrou">Nunca entraram</option>
          <option value="equipe">Da diretoria</option>
        </select>
      </div>

      <div className="mt-3 space-y-2 empty:hidden">
        {acao.erro && <Recado erro={acao.erro} />}
        {feito && <Recado sucesso={feito} aoFechar={() => setFeito(null)} />}
      </div>

      <p className="mt-3 text-sm text-apagado" aria-live="polite">
        {visiveis.length === total ? `${total} contas` : `${visiveis.length} de ${total} contas`}
      </p>

      <ul className="mt-2 space-y-3">
        {visiveis.map((u) => (
          <li key={u.id} className="cartao p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-tinta">{u.nome || "(sem nome)"}</span>
                  {u.papel && (
                    <span className="rounded-full bg-laranja/10 px-2 py-0.5 text-[11px] font-semibold text-laranja-escuro">
                      {ROTULO_PAPEL[u.papel]}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      u.emailConfirmado ? "bg-ok/10 text-ok" : "bg-ruim/10 text-ruim"
                    }`}
                  >
                    {u.emailConfirmado ? "e-mail confirmado" : "e-mail pendente"}
                  </span>
                </p>
                <p className="mt-1 text-sm break-all text-tinta">{u.email}</p>
                <p className="text-sm text-apagado">
                  {u.telefone ? formatarTelefone(u.telefone) : "sem telefone"}
                  {u.igreja && ` · ${u.igreja}`}
                </p>
                <p className="mt-1 text-xs text-apagado">
                  Conta criada {quando(u.criadoEm)} · último acesso {quando(u.ultimoAcesso)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {u.inscricoes > 0 ? (
                  <Link
                    href={`/diretoria/inscricoes?responsavel=${u.id}`}
                    className="text-sm font-semibold text-laranja-escuro hover:underline"
                  >
                    {u.inscricoes} {u.inscricoes === 1 ? "inscrição" : "inscrições"}
                  </Link>
                ) : (
                  <span className="text-sm text-apagado">sem inscrição</span>
                )}
              </div>
            </div>

            {!u.emailConfirmado && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-linha pt-3">
                <button
                  type="button"
                  disabled={acao.ocupado}
                  onClick={() => agir(u, "reenviar_confirmacao")}
                  className="botao-secundario px-3 py-1.5 text-sm"
                >
                  {acao.ocupado ? <Girando /> : null}
                  Reenviar confirmação
                </button>

                {confirmandoId === u.id ? (
                  <>
                    <span className="text-xs text-tinta">Libera a pessoa para se inscrever sem clicar no link.</span>
                    <button
                      type="button"
                      disabled={acao.ocupado}
                      onClick={() => agir(u, "confirmar_email")}
                      className="botao-primario px-3 py-1.5 text-sm"
                    >
                      Confirmar mesmo assim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoId(null)}
                      className="text-sm font-semibold text-apagado hover:underline"
                    >
                      Voltar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={acao.ocupado}
                    onClick={() => setConfirmandoId(u.id)}
                    className="text-sm font-semibold text-laranja-escuro hover:underline"
                  >
                    Confirmar manualmente
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {visiveis.length === 0 && (
        <div className="cartao mt-3 flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhuma conta com esses filtros.</p>
        </div>
      )}
    </>
  );
}

function Pendencia({
  numero,
  rotulo,
  href,
  aoClicar,
  acaoTexto,
}: {
  numero: number;
  rotulo: string;
  href?: string;
  aoClicar?: () => void;
  acaoTexto: string;
}) {
  const tem = numero > 0;
  return (
    <div className={`cartao p-4 ${tem ? "border-laranja/50 bg-laranja/5" : ""}`}>
      <p className={`titulo text-3xl ${tem ? "text-laranja-escuro" : "text-apagado"}`}>{numero}</p>
      <p className="text-sm text-apagado">{rotulo}</p>
      {tem &&
        (href ? (
          <Link href={href} className="mt-2 inline-block text-sm font-semibold text-laranja-escuro hover:underline">
            {acaoTexto} →
          </Link>
        ) : (
          <button
            type="button"
            onClick={aoClicar}
            className="mt-2 text-sm font-semibold text-laranja-escuro hover:underline"
          >
            {acaoTexto} →
          </button>
        ))}
    </div>
  );
}
