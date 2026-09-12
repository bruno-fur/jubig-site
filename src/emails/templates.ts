import { layout, texto, caixaDados, selo, CORES } from "./layout.ts";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jubig.vercel.app";

export type DadosInscricao = {
  nome: string;
  codigo: string;          // JD-0042
  evento: string;          // JubigDay 2026
  data: string;            // 17 de outubro de 2026
  local: string;           // Assis Chateaubriand
  valor: string;           // R$ 50,00
  esportes?: string[];     // ["Futsal masculino (14h)"]
  parcelas?: number;
};

/** 1. Confirme seu e-mail — sem isso não dá para se inscrever em nada. */
export function emailConfirmacaoEndereco(nome: string, url: string) {
  return {
    subject: "Confirme seu e-mail para se inscrever na JUBIG",
    html: layout({
      preheader: "Um clique e sua conta está liberada para as inscrições.",
      estado: "heh",
      titulo: `Falta um clique, ${nome.split(" ")[0]}`,
      corpo: texto(
        "Sua conta na JUBIG foi criada, mas <strong>ainda não dá para se inscrever em nenhum evento</strong> enquanto você não confirmar este endereço de e-mail.",
        "É rápido e só precisa ser feito uma vez.",
      ),
      botao: { texto: "Confirmar meu e-mail", url },
      rodapeWhatsApp: "Olá! Não consigo confirmar meu e-mail na JUBIG.",
    }),
  };
}

/** 2. Comprovante de inscrição — enviado assim que a inscrição é criada. */
export function emailInscricaoRecebida(d: DadosInscricao) {
  const itens: [string, string][] = [
    ["Código", d.codigo],
    ["Evento", d.evento],
    ["Quando", d.data],
    ["Onde", d.local],
    ["Valor", d.valor + (d.parcelas && d.parcelas > 1 ? ` em ${d.parcelas}x` : "")],
  ];
  if (d.esportes?.length) itens.push(["Esportes", d.esportes.join(", ")]);

  return {
    subject: `Inscrição ${d.codigo} registrada — falta o pagamento`,
    html: layout({
      preheader: `Guarde o código ${d.codigo}. O próximo passo é enviar o comprovante do PIX.`,
      estado: "joia",
      titulo: "Inscrição registrada!",
      corpo:
        texto(`Oi ${d.nome.split(" ")[0]}, anotamos sua inscrição. Este é o seu comprovante:`) +
        caixaDados(itens) +
        texto(
          `${selo("Aguardando pagamento", CORES.laranjaEscuro, "#FBE6D5")}`,
          "<strong>Sua vaga ainda não está garantida.</strong> Faça o PIX e envie a foto do comprovante pelo site — a diretoria confere e confirma.",
        ),
      botao: { texto: "Pagar e enviar comprovante", url: `${SITE}/inscricoes/${d.codigo}` },
      rodapeWhatsApp: `Olá! Sou ${d.nome}, inscrição ${d.codigo}.`,
    }),
  };
}

/** 3. Recebemos seu comprovante — está na fila da diretoria. */
export function emailComprovanteRecebido(d: DadosInscricao) {
  return {
    subject: `Comprovante da inscrição ${d.codigo} recebido`,
    html: layout({
      preheader: "Agora é com a diretoria. A resposta sai em até 48 horas.",
      estado: "nervoso",
      titulo: "Comprovante recebido",
      corpo:
        texto(
          `Chegou aqui, ${d.nome.split(" ")[0]}. A diretoria vai conferir seu pagamento e confirmar a vaga.`,
        ) +
        caixaDados([
          ["Código", d.codigo],
          ["Evento", d.evento],
          ["Situação", "Em análise"],
        ]) +
        texto("Costuma levar até 48 horas. Você recebe um e-mail assim que houver resposta — não precisa enviar de novo."),
      botao: { texto: "Acompanhar inscrição", url: `${SITE}/minhas-inscricoes` },
      rodapeWhatsApp: `Olá! Enviei o comprovante da inscrição ${d.codigo}.`,
    }),
  };
}

/** 4a. Aprovado — vaga garantida. */
export function emailInscricaoAprovada(d: DadosInscricao) {
  return {
    subject: `Vaga confirmada no ${d.evento}!`,
    html: layout({
      preheader: `Tudo certo, ${d.codigo} está confirmada. Te esperamos dia ${d.data}.`,
      estado: "joia",
      titulo: "Vaga confirmada!",
      corpo:
        texto(`Pagamento conferido, ${d.nome.split(" ")[0]}. Sua vaga está garantida.`) +
        caixaDados([
          ["Código", d.codigo],
          ["Evento", d.evento],
          ["Quando", d.data],
          ["Onde", d.local],
          ...(d.esportes?.length ? ([["Esportes", d.esportes.join(", ")]] as [string, string][]) : []),
        ]) +
        texto(
          `${selo("Confirmada", "#1F5C2C", "#DFF0E2")}`,
          "Leve este código na chegada — é o que agiliza o credenciamento.",
        ),
      botao: { texto: "Ver minha inscrição", url: `${SITE}/minhas-inscricoes` },
      rodapeWhatsApp: `Olá! Minha inscrição ${d.codigo} foi confirmada.`,
    }),
  };
}

/** 4b. Recusado — com o motivo e o caminho para resolver. */
export function emailComprovanteRecusado(d: DadosInscricao, motivo: string) {
  return {
    subject: `Precisamos de outro comprovante — inscrição ${d.codigo}`,
    html: layout({
      preheader: "Dá para resolver em um minuto, sem refazer o cadastro.",
      estado: "choro",
      titulo: "Não conseguimos validar seu pagamento",
      corpo:
        texto(
          `${d.nome.split(" ")[0]}, a diretoria olhou seu comprovante e não deu para confirmar.`,
        ) +
        caixaDados([
          ["Código", d.codigo],
          ["Motivo", motivo],
        ]) +
        texto(
          "<strong>Seus dados continuam salvos.</strong> É só enviar um novo comprovante — não precisa preencher tudo de novo nem pagar outra vez.",
          "Se você tem certeza de que o pagamento foi feito, chama a diretoria no WhatsApp com o comprovante em mãos.",
        ),
      botao: { texto: "Enviar outro comprovante", url: `${SITE}/inscricoes/${d.codigo}` },
      rodapeWhatsApp: `Olá! Meu comprovante da inscrição ${d.codigo} foi recusado, mas fiz o pagamento.`,
    }),
  };
}
