"use client";

import { useMemo, useState } from "react";
import { formatarTelefone } from "@/lib/validacao";
import { ROTULO_PAPEL } from "@/tipos/db";
import type { UsuarioGeral } from "@/lib/usuarios";

type Filtro = "todos" | "pendentes" | "com_inscricao" | "equipe";

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
 * Visão geral das contas. Lista de dado pessoal de jovens a partir de 12 anos:
 * só admin enxerga, nada fica em cache, e não há exportação daqui — o CSV de
 * inscritos já cobre o que a diretoria precisa operar.
 */
export function ListaUsuarios({ usuarios }: { usuarios: UsuarioGeral[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visiveis = useMemo(() => {
    const q = normal(busca.trim());
    return usuarios.filter((u) => {
      if (filtro === "pendentes" && u.emailConfirmado) return false;
      if (filtro === "com_inscricao" && u.inscricoes === 0) return false;
      if (filtro === "equipe" && !u.papel) return false;
      if (!q) return true;
      return [u.nome, u.email, u.igreja ?? "", u.telefone ?? ""].some((c) => normal(c).includes(q));
    });
  }, [usuarios, busca, filtro]);

  const total = usuarios.length;
  const confirmados = usuarios.filter((u) => u.emailConfirmado).length;
  const comInscricao = usuarios.filter((u) => u.inscricoes > 0).length;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Numero rotulo="Contas" valor={total} />
        <Numero rotulo="E-mail confirmado" valor={confirmados} />
        <Numero rotulo="Com inscrição" valor={comInscricao} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
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
          <option value="todos">Todos</option>
          <option value="pendentes">E-mail não confirmado</option>
          <option value="com_inscricao">Com inscrição</option>
          <option value="equipe">Da diretoria</option>
        </select>
      </div>

      <p className="mt-3 text-sm text-apagado" aria-live="polite">
        {visiveis.length === total ? `${total} contas` : `${visiveis.length} de ${total} contas`}
      </p>

      <div className="mt-2 overflow-x-auto rounded-[16px] border border-linha bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-linha bg-areia/50 text-xs text-apagado">
            <tr>
              <th className="px-4 py-3 font-semibold">Pessoa</th>
              <th className="px-4 py-3 font-semibold">Contato</th>
              <th className="px-4 py-3 font-semibold">Igreja</th>
              <th className="px-4 py-3 font-semibold">Conta</th>
              <th className="px-4 py-3 text-right font-semibold">Inscrições</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {visiveis.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3">
                  <span className="block font-semibold text-tinta">{u.nome || "(sem nome)"}</span>
                  {u.papel && (
                    <span className="mt-1 inline-block rounded-full bg-laranja/10 px-2 py-0.5 text-[11px] font-semibold text-laranja-escuro">
                      {ROTULO_PAPEL[u.papel]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="block break-all text-tinta">{u.email}</span>
                  <span className="block text-apagado">
                    {u.telefone ? formatarTelefone(u.telefone) : "sem telefone"}
                  </span>
                </td>
                <td className="px-4 py-3 text-apagado">{u.igreja || "—"}</td>
                <td className="px-4 py-3 text-xs text-apagado">
                  <span className={`block font-semibold ${u.emailConfirmado ? "text-ok" : "text-ruim"}`}>
                    {u.emailConfirmado ? "e-mail confirmado" : "e-mail pendente"}
                  </span>
                  <span className="block">criada {quando(u.criadoEm)}</span>
                  <span className="block">último acesso {quando(u.ultimoAcesso)}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-tinta">{u.inscricoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="cartao p-4">
      <p className="titulo text-2xl text-tinta">{valor}</p>
      <p className="mt-0.5 text-xs text-apagado">{rotulo}</p>
    </div>
  );
}
