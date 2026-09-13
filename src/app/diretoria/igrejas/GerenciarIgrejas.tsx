"use client";

import { useEffect, useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import {
  buscarCep,
  geocodificar,
  listarCidades,
  listarEstados,
  mascaraCep,
  type Estado,
} from "@/lib/endereco";
import type { Igreja } from "@/tipos/db";

const MENSAGEM: Record<string, string> = {
  tem_eventos: "Essa igreja já sediou um evento. Desative em vez de apagar, para não perder o histórico.",
  sem_permissao: "Só administrador mexe nas igrejas.",
  pedido_invalido: "Confira os campos: nome, estado e cidade são obrigatórios.",
};

export function GerenciarIgrejas({ igrejas }: { igrejas: Igreja[] }) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const [editando, setEditando] = useState<string | null>(null);
  const [estados, setEstados] = useState<Estado[]>([]);

  useEffect(() => {
    let vivo = true;
    listarEstados()
      .then((l) => vivo && setEstados(l))
      .catch(() => vivo && setEstados([]));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <>
      <div className="mb-4 empty:hidden">
        <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
      </div>

      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">Nova igreja</h2>
        <p className="mt-1 text-sm text-apagado">
          Comece pelo CEP: ele preenche rua, bairro, cidade e estado. A localização no mapa é
          buscada sozinha quando você salva.
        </p>
        <Formulario
          estados={estados}
          ocupado={acao.ocupado}
          rotuloBotao="Adicionar"
          aoSalvar={(dados) => acao.json("/api/admin/igrejas", "POST", dados).then((r) => r.ok)}
        />
      </section>

      <ul className="cartao divide-y divide-linha">
        {igrejas.map((i) =>
          editando === i.id ? (
            <li key={i.id} className="p-5">
              <Formulario
                igreja={i}
                estados={estados}
                ocupado={acao.ocupado}
                rotuloBotao="Salvar"
                aoSalvar={async (dados) => {
                  const { ok } = await acao.json("/api/admin/igrejas", "PATCH", { id: i.id, ...dados });
                  if (ok) setEditando(null);
                  return ok;
                }}
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
                </span>
                {i.endereco && <span className="block text-sm text-apagado">{i.endereco}</span>}
                <span className="block text-xs">
                  {i.latitude !== null && i.longitude !== null ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${i.latitude}&mlon=${i.longitude}#map=17/${i.latitude}/${i.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ok hover:underline"
                    >
                      no mapa — conferir o ponto
                    </a>
                  ) : (
                    <span className="text-ruim">sem localização — não aparece no mapa</span>
                  )}
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

type Dados = Record<string, unknown>;

function Formulario({
  igreja,
  estados,
  ocupado,
  rotuloBotao,
  aoSalvar,
  aoCancelar,
}: {
  igreja?: Igreja;
  estados: Estado[];
  ocupado: boolean;
  rotuloBotao: string;
  aoSalvar: (dados: Dados) => Promise<boolean>;
  aoCancelar?: () => void;
}) {
  const [nome, setNome] = useState(igreja?.nome ?? "");
  const [cep, setCep] = useState(igreja?.cep ? mascaraCep(igreja.cep) : "");
  const [estado, setEstado] = useState(igreja?.estado ?? "PR");
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidade, setCidade] = useState(igreja?.cidade ?? "");
  const [logradouro, setLogradouro] = useState(igreja?.logradouro ?? "");
  const [numero, setNumero] = useState(igreja?.numero ?? "");
  const [complemento, setComplemento] = useState(igreja?.complemento ?? "");
  const [bairro, setBairro] = useState(igreja?.bairro ?? "");
  const [responsavel, setResponsavel] = useState(igreja?.responsavel ?? "");
  const [instagram, setInstagram] = useState(igreja?.instagram ?? "");
  const [ativa, setAtiva] = useState(igreja?.ativa ?? true);

  const [avisoCep, setAvisoCep] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);

  // Cidades do estado escolhido. Refaz quando o estado muda.
  useEffect(() => {
    if (!estado) return;
    let vivo = true;
    listarCidades(estado)
      .then((l) => vivo && setCidades(l))
      .catch(() => vivo && setCidades([]));
    return () => {
      vivo = false;
    };
  }, [estado]);

  async function aoMudarCep(valor: string) {
    const mascarado = mascaraCep(valor);
    setCep(mascarado);
    setAvisoCep(null);
    if (mascarado.replace(/\D/g, "").length !== 8) return;

    setBuscandoCep(true);
    const achado = await buscarCep(mascarado).catch(() => null);
    setBuscandoCep(false);

    if (!achado) {
      setAvisoCep("CEP não encontrado. Preencha o endereço à mão.");
      return;
    }
    setEstado(achado.estado);
    setCidade(achado.cidade);
    // CEP de cidade pequena é um só para a cidade inteira e vem sem rua:
    // não apaga o que já estava digitado.
    if (achado.logradouro) setLogradouro(achado.logradouro);
    if (achado.bairro) setBairro(achado.bairro);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setAvisoLocal(null);

    let latitude = igreja?.latitude ?? null;
    let longitude = igreja?.longitude ?? null;

    const mudouEndereco =
      !igreja ||
      logradouro !== (igreja.logradouro ?? "") ||
      numero !== (igreja.numero ?? "") ||
      cidade !== igreja.cidade ||
      estado !== igreja.estado;

    // Só busca de novo quando o endereço mudou: o Nominatim pede uso moderado.
    if (mudouEndereco) {
      latitude = null;
      longitude = null;
      if (logradouro.trim() && cidade) {
        setLocalizando(true);
        const achado = await geocodificar({ logradouro, numero, cidade, estado, cep }).catch(() => null);
        setLocalizando(false);
        if (achado) {
          latitude = achado.latitude;
          longitude = achado.longitude;
          if (achado.precisao === "rua")
            setAvisoLocal("Achei a rua, mas não o número exato. O pino fica na rua — confira no mapa.");
        } else {
          setAvisoLocal(
            "Não achei esse endereço no mapa. A igreja fica salva e aparece na lista, mas não no mapa. Confira a grafia da rua."
          );
        }
      }
    }

    const ok = await aoSalvar({
      nome,
      estado,
      cidade,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      latitude,
      longitude,
      responsavel,
      instagram,
      ativa,
    });

    if (ok && !igreja) {
      setNome("");
      setCep("");
      setLogradouro("");
      setNumero("");
      setComplemento("");
      setBairro("");
      setResponsavel("");
      setInstagram("");
    }
  }

  const ocupadoTudo = ocupado || localizando;

  return (
    <form onSubmit={salvar} className="mt-3 grid gap-3 sm:grid-cols-6">
      <Rotulo texto="Nome" classe="sm:col-span-6">
        <input required value={nome} onChange={(e) => setNome(e.target.value)} className="campo-texto" />
      </Rotulo>

      <Rotulo texto="CEP" classe="sm:col-span-2">
        <span className="relative block">
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => aoMudarCep(e.target.value)}
            className="campo-texto"
          />
          {buscandoCep && <Girando className="absolute top-1/2 right-3 -translate-y-1/2 text-apagado" />}
        </span>
        {avisoCep && <span className="mt-1 block text-xs text-ruim">{avisoCep}</span>}
      </Rotulo>

      <Rotulo texto="Estado" classe="sm:col-span-2">
        <select
          required
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setCidade("");
          }}
          className="campo-texto"
        >
          {estados.length === 0 && <option value={estado}>{estado}</option>}
          {estados.map((uf) => (
            <option key={uf.sigla} value={uf.sigla}>
              {uf.nome}
            </option>
          ))}
        </select>
      </Rotulo>

      <Rotulo texto="Cidade" classe="sm:col-span-2">
        <select
          required
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          className="campo-texto"
          disabled={cidades.length === 0 && !cidade}
        >
          <option value="">{cidades.length ? "Escolha a cidade" : "Carregando..."}</option>
          {/* Cidade já salva antes da lista carregar continua escolhida. */}
          {cidade && !cidades.includes(cidade) && <option value={cidade}>{cidade}</option>}
          {cidades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Rotulo>

      <Rotulo texto="Rua" classe="sm:col-span-4">
        <input
          value={logradouro}
          onChange={(e) => setLogradouro(e.target.value)}
          autoComplete="address-line1"
          className="campo-texto"
        />
      </Rotulo>

      <Rotulo texto="Número" classe="sm:col-span-2">
        <input
          value={numero}
          inputMode="numeric"
          onChange={(e) => setNumero(e.target.value)}
          className="campo-texto"
        />
      </Rotulo>

      <Rotulo texto="Bairro" classe="sm:col-span-3">
        <input value={bairro} onChange={(e) => setBairro(e.target.value)} className="campo-texto" />
      </Rotulo>

      <Rotulo texto="Complemento" classe="sm:col-span-3">
        <input
          value={complemento}
          placeholder="Salão, fundos, bloco..."
          onChange={(e) => setComplemento(e.target.value)}
          className="campo-texto"
        />
      </Rotulo>

      <Rotulo texto="Responsável" classe="sm:col-span-3">
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="campo-texto" />
      </Rotulo>

      <Rotulo texto="Instagram" classe="sm:col-span-3">
        <input
          value={instagram}
          placeholder="sem o @"
          onChange={(e) => setInstagram(e.target.value)}
          className="campo-texto"
        />
      </Rotulo>

      {avisoLocal && (
        <p className="rounded-[10px] bg-laranja/10 px-3 py-2 text-sm text-laranja-escuro sm:col-span-6">
          {avisoLocal}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-apagado sm:col-span-3">
        <input
          type="checkbox"
          checked={ativa}
          onChange={(e) => setAtiva(e.target.checked)}
          className="h-4 w-4 accent-[#D94C1A]"
        />
        Aparece no site
      </label>

      <span className="flex gap-2 sm:col-span-3 sm:justify-end">
        {aoCancelar && (
          <button type="button" onClick={aoCancelar} className="botao-secundario">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={ocupadoTudo} className="botao-primario">
          {ocupadoTudo ? (
            <>
              <Girando />
              {localizando ? "Localizando..." : "Salvando..."}
            </>
          ) : (
            rotuloBotao
          )}
        </button>
      </span>
    </form>
  );
}

function Rotulo({ texto, classe = "", children }: { texto: string; classe?: string; children: React.ReactNode }) {
  return (
    <label className={classe}>
      <span className="mb-1 block text-sm font-semibold text-tinta">{texto}</span>
      {children}
    </label>
  );
}
