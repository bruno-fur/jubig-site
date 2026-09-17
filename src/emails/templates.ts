import { layout, texto, caixaDados, selo, CORES, COMUNIDADE_PADRAO } from "./layout.ts";
import { urlDoSite } from "../lib/site.ts";

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
        texto(`Oi ${escapar(d.nome.split(" ")[0])}, anotamos sua inscrição. Este é o seu comprovante:`) +
        caixaDados(itens) +
        texto(
          `${selo("Aguardando pagamento", CORES.laranjaEscuro, "#FBE6D5")}`,
          "<strong>Sua vaga ainda não está garantida.</strong> Faça o PIX e envie a foto do comprovante pelo site — a diretoria confere e confirma.",
        ),
      botao: { texto: "Pagar e enviar comprovante", url: `${urlDoSite()}/inscricoes/${d.codigo}` },
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
          `Chegou aqui, ${escapar(d.nome.split(" ")[0])}. A diretoria vai conferir seu pagamento e confirmar a vaga.`,
        ) +
        caixaDados([
          ["Código", d.codigo],
          ["Evento", d.evento],
          ["Situação", "Em análise"],
        ]) +
        texto("Costuma levar até 48 horas. Você recebe um e-mail assim que houver resposta — não precisa enviar de novo."),
      botao: { texto: "Acompanhar inscrição", url: `${urlDoSite()}/minhas-inscricoes` },
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
        texto(`Pagamento conferido, ${escapar(d.nome.split(" ")[0])}. Sua vaga está garantida.`) +
        caixaDados([
          ["Código", d.codigo],
          ["Evento", d.evento],
          ["Quando", d.data],
          ["Onde", d.local],
          ...(d.esportes?.length ? ([["Esportes", d.esportes.join(", ")]] as [string, string][]) : []),
        ]) +
        texto(
          `${selo("Confirmada", "#1F5C2C", "#DFF0E2")}`,
          "Os ingressos com QR Code já estão liberados — um para cada pessoa. Baixe ou imprima e leve na chegada: é o que agiliza a portaria.",
          `Os avisos do evento saem na <a href="${COMUNIDADE_PADRAO}" style="color:${CORES.laranjaEscuro};font-weight:600;">comunidade da JUBIG no WhatsApp</a> — entre para não perder nada.`,
        ),
      botao: { texto: "Baixar os ingressos", url: `${urlDoSite()}/inscricoes/${d.codigo}/ingressos` },
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
          `${escapar(d.nome.split(" ")[0])}, a diretoria olhou seu comprovante e não deu para confirmar.`,
        ) +
        caixaDados([
          ["Código", d.codigo],
          ["Motivo", motivo],
        ]) +
        texto(
          "<strong>Seus dados continuam salvos.</strong> É só enviar um novo comprovante — não precisa preencher tudo de novo nem pagar outra vez.",
          "Se você tem certeza de que o pagamento foi feito, chama a diretoria no WhatsApp com o comprovante em mãos.",
        ),
      botao: { texto: "Enviar outro comprovante", url: `${urlDoSite()}/inscricoes/${d.codigo}` },
      rodapeWhatsApp: `Olá! Meu comprovante da inscrição ${d.codigo} foi recusado, mas fiz o pagamento.`,
    }),
  };
}

/** 5. Redefinir senha — link de uso único, vale 1 hora. */
export function emailRedefinirSenha(nome: string, url: string) {
  const primeiro = nome.trim().split(" ")[0];
  return {
    subject: "Redefinir sua senha da JUBIG",
    html: layout({
      preheader: "O link vale por 1 hora e só funciona uma vez.",
      estado: "heh",
      titulo: primeiro ? `Bora trocar essa senha, ${primeiro}` : "Bora trocar essa senha",
      corpo: texto(
        "Alguém pediu para redefinir a senha desta conta. Se foi você, é só clicar no botão abaixo e escolher uma senha nova.",
        "<strong>O link vale por 1 hora</strong> e só funciona uma vez.",
        "Se não foi você, pode ignorar este e-mail: sua senha continua a mesma.",
      ),
      botao: { texto: "Escolher senha nova", url },
      rodapeWhatsApp: "Olá! Não consigo redefinir minha senha na JUBIG.",
    }),
  };
}

export type DadosAviso = {
  evento: string;
  slug: string;
  titulo: string;
  mensagem: string;
};

/** 6. Aviso da diretoria sobre um evento. */
export function emailAviso(nome: string, a: DadosAviso) {
  const primeiro = nome.trim().split(" ")[0];
  // O texto vem do painel: quebra de linha vira parágrafo, e HTML digitado
  // é escapado para não quebrar o layout nem virar link malicioso.
  const paragrafos = a.mensagem
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => escapar(p).replace(/\n/g, "<br>"));

  return {
    subject: `${a.evento}: ${a.titulo}`,
    html: layout({
      // O layout interpola sem escapar; título vem digitado do painel.
      preheader: a.titulo,
      estado: "heh",
      titulo: a.titulo,
      corpo:
        texto(primeiro ? `Oi ${escapar(primeiro)}, novidade sobre o <strong>${escapar(a.evento)}</strong>:` : `Novidade sobre o <strong>${escapar(a.evento)}</strong>:`) +
        texto(...paragrafos),
      botao: { texto: "Ver o evento", url: `${urlDoSite()}/${a.slug}` },
      rodapeWhatsApp: `Olá! Vi o aviso sobre o ${a.evento}.`,
    }),
  };
}

export type DadosLembrete = {
  evento: string;
  slug: string;
  data: string;
  local: string;
  codigo: string;
  confirmada: boolean;
};

/** 7. Lembrete automático perto da data. */
export function emailLembrete(nome: string, tipo: "semana" | "vespera", d: DadosLembrete) {
  const primeiro = nome.trim().split(" ")[0] || "pessoal";

  if (tipo === "vespera") {
    return {
      subject: `É amanhã: ${d.evento}!`,
      html: layout({
        preheader: "Separe o ingresso com QR Code — ele agiliza a portaria.",
        estado: "choque",
        titulo: `É amanhã, ${primeiro}!`,
        corpo:
          texto(`O <strong>${escapar(d.evento)}</strong> é amanhã.`) +
          caixaDados([
            ["Quando", d.data],
            ["Onde", d.local],
            ["Código", d.codigo],
          ]) +
          texto("Leve o ingresso de cada pessoa — no celular ou impresso. É o QR Code que libera a entrada."),
        botao: { texto: "Abrir os ingressos", url: `${urlDoSite()}/inscricoes/${d.codigo}/ingressos` },
        rodapeWhatsApp: `Olá! Dúvida sobre amanhã, inscrição ${d.codigo}.`,
      }),
    };
  }

  return {
    subject: d.confirmada
      ? `Falta uma semana para o ${d.evento}`
      : `Falta uma semana e sua inscrição ${d.codigo} ainda não está confirmada`,
    html: layout({
      preheader: d.confirmada
        ? "Sua vaga está garantida. Já dá para baixar os ingressos."
        : "Envie o comprovante do PIX para garantir a vaga.",
      estado: d.confirmada ? "joia" : "susto",
      titulo: d.confirmada ? "Falta uma semana!" : "Falta uma semana — e o pagamento?",
      corpo:
        caixaDados([
          ["Evento", d.evento],
          ["Quando", d.data],
          ["Onde", d.local],
          ["Código", d.codigo],
        ]) +
        texto(
          d.confirmada
            ? "Vaga garantida. Os ingressos com QR Code já estão disponíveis."
            : "<strong>Sua vaga ainda não está garantida.</strong> Se já pagou, envie o comprovante pelo site; se ainda não, o PIX está na página da inscrição.",
        ),
      botao: d.confirmada
        ? { texto: "Baixar os ingressos", url: `${urlDoSite()}/inscricoes/${d.codigo}/ingressos` }
        : { texto: "Pagar e enviar comprovante", url: `${urlDoSite()}/inscricoes/${d.codigo}` },
      rodapeWhatsApp: `Olá! Sobre a inscrição ${d.codigo} no ${d.evento}.`,
    }),
  };
}

function escapar(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type DadosCancelamento = {
  codigo: string;
  evento: string;
  slug: string;
  data: string;
  motivo: string;
  estavaPaga: boolean;
};

/** 8. A diretoria cancelou a inscrição. */
export function emailInscricaoCancelada(nome: string, d: DadosCancelamento) {
  const primeiro = nome.trim().split(" ")[0];
  return {
    subject: `Inscrição ${d.codigo} cancelada`,
    html: layout({
      preheader: `A diretoria cancelou sua inscrição no ${d.evento}.`,
      estado: "choro",
      titulo: "Sua inscrição foi cancelada",
      corpo:
        texto(
          `${primeiro ? `${escapar(primeiro)}, a` : "A"} diretoria cancelou a inscrição <strong>${escapar(d.codigo)}</strong> no ${escapar(d.evento)} (${escapar(d.data)}).`,
        ) +
        caixaDados([
          ["Código", d.codigo],
          ["Motivo", d.motivo || "não informado"],
        ]) +
        texto(
          d.estavaPaga
            ? "<strong>Essa inscrição já estava paga.</strong> Fale com a diretoria no WhatsApp para combinar a devolução do PIX."
            : "Se foi engano, é só falar com a diretoria ou fazer uma nova inscrição pelo site.",
        ),
      botao: { texto: "Ver o evento", url: `${urlDoSite()}/${d.slug}` },
      rodapeWhatsApp: `Olá! Minha inscrição ${d.codigo} foi cancelada e queria entender.`,
    }),
  };
}
