"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";

const MENSAGEM: Record<string, string> = {
  whatsapp_invalido: "WhatsApp inválido. Use DDD e número, ex.: (45) 99811-2434 — ou +595 para Paraguai.",
  instagram_invalido: "Instagram inválido. Use só o nome do perfil, ex.: jubigoficial.",
  email_invalido: "E-mail de contato inválido.",
  pedido_invalido: "WhatsApp e Instagram são obrigatórios.",
  sem_permissao: "Só administrador muda os dados do site.",
  falha_ao_gravar: "Não deu para salvar. Confira se o schema.sql novo já foi aplicado no Supabase.",
};

type Dados = { whatsapp: string; instagram: string; emailContato: string; quemSomos: string };

/** "5545998112434" → "+55 45 99811-2434", só para leitura fácil no campo. */
function legivel(digitos: string) {
  const d = digitos.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.startsWith("55") && d.length === 12) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

export function FormularioSite({ inicial }: { inicial: Dados }) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo. O site já mostra os dados novos." });
  const [d, setD] = useState<Dados>({ ...inicial, whatsapp: legivel(inicial.whatsapp) });
  const mudar = (campo: keyof Dados, valor: string) => setD((atual) => ({ ...atual, [campo]: valor }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void acao.json("/api/admin/configuracoes", "PATCH", {
          whatsapp: d.whatsapp,
          instagram: d.instagram,
          emailContato: d.emailContato || null,
          quemSomos: d.quemSomos || null,
        });
      }}
      className="cartao space-y-4 p-5"
    >
      <div>
        <h2 className="titulo text-xl">Contatos e textos</h2>
        <p className="text-sm text-apagado">
          Aparecem no rodapé, no &quot;Falar com a gente&quot; da home, na tela de erro e nos e-mails.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-tinta">
            WhatsApp da diretoria <span className="text-laranja">*</span>
          </span>
          <input
            type="tel"
            value={d.whatsapp}
            onChange={(e) => mudar("whatsapp", e.target.value)}
            placeholder="+55 45 99811-2434"
            className="campo-texto"
          />
          <span className="mt-1 block text-xs text-apagado">Número que atende as dúvidas das caravanas.</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-tinta">
            Instagram <span className="text-laranja">*</span>
          </span>
          <input
            value={d.instagram}
            onChange={(e) => mudar("instagram", e.target.value)}
            placeholder="jubigoficial"
            className="campo-texto"
          />
          <span className="mt-1 block text-xs text-apagado">Pode colar o link do perfil ou o @.</span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-tinta">E-mail de contato</span>
        <input
          type="email"
          value={d.emailContato}
          onChange={(e) => mudar("emailContato", e.target.value)}
          placeholder="jubig.ofc@gmail.com"
          className="campo-texto"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-tinta">Texto do &quot;Quem somos&quot;</span>
        <textarea
          value={d.quemSomos}
          onChange={(e) => mudar("quemSomos", e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Vazio: a home usa o texto padrão."
          className="campo-texto"
        />
        <span className="mt-1 block text-xs text-apagado">
          {d.quemSomos.length}/2000 · linha em branco separa parágrafos.
        </span>
      </label>

      {(acao.erro || acao.feito) && <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />}

      <button type="submit" disabled={acao.ocupado} className="botao-primario">
        {acao.ocupado ? (
          <>
            <Girando />
            Salvando...
          </>
        ) : (
          "Salvar"
        )}
      </button>
    </form>
  );
}
