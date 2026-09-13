"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";

type EventoOpcao = { id: string; nome: string; temInscricao: boolean; inscricoes: number };
type Aviso = {
  id: string;
  evento_id: string;
  titulo: string;
  mensagem: string;
  criado_em: string;
  enviados: number;
};

const MENSAGEM: Record<string, string> = {
  pedido_invalido: "Título com pelo menos 3 letras e mensagem com pelo menos 5.",
  sem_permissao: "Só administrador publica aviso.",
  evento_nao_encontrado: "Evento não encontrado.",
};

export function PublicarAviso({ eventos, avisos }: { eventos: EventoOpcao[]; avisos: Aviso[] }) {
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const acao = useAcao({ mensagens: MENSAGEM });

  const evento = eventos.find((e) => e.id === eventoId);
  const nomeDo = (id: string) => eventos.find((e) => e.id === id)?.nome ?? "";

  async function publicar() {
    setResultado(null);
    const { ok, dados } = await acao.json("/api/admin/avisos", "POST", {
      eventoId,
      titulo,
      mensagem,
      enviarEmail: enviarEmail && Boolean(evento?.temInscricao),
    });
    setConfirmando(false);
    if (!ok) return;

    setTitulo("");
    setMensagem("");
    const enviados = Number(dados.enviados ?? 0);
    const fora = Number(dados.ficaramDeFora ?? 0);
    const falhas = Number(dados.falhas ?? 0);
    setResultado(
      [
        "Aviso publicado na página do evento.",
        enviados > 0 && `${enviados} e-mail${enviados > 1 ? "s" : ""} enviado${enviados > 1 ? "s" : ""}.`,
        falhas > 0 && `${falhas} não saíram — veja o log do Gmail.`,
        fora > 0 && `${fora} ficaram de fora pelo limite diário do Gmail; publique de novo amanhã só para eles.`,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return (
    <>
      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">Novo aviso</h2>
        <p className="mt-1 text-sm text-apagado">
          Aparece na página do evento e vai por e-mail para quem se inscreveu — um e-mail por
          responsável de inscrição, não por pessoa da caravana.
        </p>

        <div className="mt-4 grid gap-3">
          <label>
            <span className="mb-1 block text-sm font-semibold text-tinta">Evento</span>
            <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="campo-texto">
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm font-semibold text-tinta">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              placeholder="Mudou o horário de chegada"
              className="campo-texto"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-semibold text-tinta">Mensagem</span>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder={"Linha em branco separa parágrafos."}
              className="campo-texto"
            />
          </label>

          {evento?.temInscricao ? (
            <label className="flex items-center gap-2 text-sm text-tinta">
              <input
                type="checkbox"
                checked={enviarEmail}
                onChange={(e) => setEnviarEmail(e.target.checked)}
                className="h-4 w-4 accent-[#D94C1A]"
              />
              Enviar por e-mail para as inscrições ativas
              <span className="text-apagado">({evento.inscricoes})</span>
            </label>
          ) : (
            <p className="text-sm text-apagado">
              Este evento não tem inscrição — o aviso aparece só na página dele.
            </p>
          )}
        </div>

        {acao.erro && (
          <div className="mt-3">
            <Recado erro={acao.erro} />
          </div>
        )}
        {resultado && (
          <div className="mt-3">
            <Recado sucesso={resultado} />
          </div>
        )}

        {confirmando ? (
          <div className="mt-4 rounded-[10px] bg-laranja/10 p-4">
            <p className="text-sm text-tinta">
              {enviarEmail && evento?.temInscricao
                ? `Isso manda e-mail agora para até ${evento.inscricoes} responsáveis. E-mail enviado não volta atrás.`
                : "O aviso vai aparecer na página do evento."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={publicar} disabled={acao.ocupado} className="botao-primario">
                {acao.ocupado ? (
                  <>
                    <Girando />
                    Enviando...
                  </>
                ) : (
                  "Confirmar e publicar"
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={acao.ocupado}
                className="botao-secundario"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={titulo.trim().length < 3 || mensagem.trim().length < 5}
            onClick={() => setConfirmando(true)}
            className="botao-primario mt-4"
          >
            Publicar aviso
          </button>
        )}
      </section>

      <h2 className="titulo mb-2 text-lg">Avisos publicados</h2>
      {avisos.length === 0 ? (
        <div className="cartao flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhum aviso ainda.</p>
        </div>
      ) : (
        <ul className="cartao divide-y divide-linha">
          {avisos.map((a) => (
            <li key={a.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-tinta">{a.titulo}</p>
                <p className="text-xs text-apagado">
                  {nomeDo(a.evento_id)} · {new Date(a.criado_em).toLocaleString("pt-BR")} ·{" "}
                  {a.enviados} e-mail{a.enviados === 1 ? "" : "s"}
                </p>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-apagado">{a.mensagem}</p>
              <button
                type="button"
                disabled={acao.ocupado}
                onClick={() => acao.json("/api/admin/avisos", "DELETE", { id: a.id })}
                className="mt-2 text-xs font-semibold text-ruim hover:underline disabled:opacity-40"
                title="Tira da página do evento. E-mail já enviado não volta."
              >
                Tirar do site
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
