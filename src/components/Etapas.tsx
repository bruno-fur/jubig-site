export function Etapas({ titulos, atual }: { titulos: string[]; atual: number }) {
  return (
    <ol
      className="mt-7 flex items-center gap-2"
      aria-label={`Etapa ${atual + 1} de ${titulos.length}: ${titulos[atual]}`}
    >
      {titulos.map((t, i) => {
        const feita = i < atual;
        const agora = i === atual;
        return (
          <li key={t} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${
                feita || agora ? "bg-laranja" : "bg-linha"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-semibold ${
                agora ? "text-laranja-escuro" : feita ? "text-tinta" : "text-apagado"
              }`}
            >
              {t}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
