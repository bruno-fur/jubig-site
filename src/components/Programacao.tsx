import { diaLegivel, emOrdem, horaLegivel, TIPOS, type ItemProgramacao } from "@/lib/programacao";

/**
 * Programação do evento, agrupada por dia.
 *
 * Congresso tem quatro dias: numa lista só, ninguém acha o que acontece no
 * sábado. Evento de um dia não mostra cabeçalho de data — seria repetir o que
 * já está no topo da página.
 */
export function Programacao({ itens }: { itens: ItemProgramacao[] }) {
  const ordenados = emOrdem(itens);
  const temDia = ordenados.some((i) => i.dia);

  const dias = new Map<string, ItemProgramacao[]>();
  for (const i of ordenados) {
    const chave = i.dia ?? "";
    dias.set(chave, [...(dias.get(chave) ?? []), i]);
  }

  return (
    <div className="space-y-6">
      {[...dias.entries()].map(([dia, doDia]) => (
        <div key={dia || "unico"}>
          {temDia && dia && <h3 className="titulo mb-2 text-lg text-laranja-escuro">{diaLegivel(dia)}</h3>}

          <ol className="cartao divide-y divide-linha">
            {doDia.map((p) => (
              <li key={p.id} className="flex gap-4 p-4">
                <span className="titulo w-16 shrink-0 text-laranja-escuro">{horaLegivel(p)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-tinta">{p.titulo}</span>
                    {p.tipo && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TIPOS[p.tipo].cor}`}>
                        {TIPOS[p.tipo].rotulo}
                      </span>
                    )}
                  </span>
                  {p.descricao && <span className="mt-0.5 block text-sm text-apagado">{p.descricao}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
