import { gerarBRCode } from "../src/lib/pix.ts";
import { validarCPF, idadeNaData, dataValida, paraE164, nomeCompleto } from "../src/lib/validacao.ts";
import { mascaraCPF, mascaraData, dataParaISO, mascaraTelefone } from "../src/lib/mascaras.ts";

const ok = (nome: string, real: unknown, esperado: unknown) =>
  console.log(`${JSON.stringify(real) === JSON.stringify(esperado) ? "ok  " : "FALHA"} ${nome}: ${JSON.stringify(real)}`);

// --- PIX ---
const br = gerarBRCode({ chave: "jubig@exemplo.org.br", nome: "Juventude Batista", cidade: "Assis Chateaubriand", valorCentavos: 5000, identificador: "JD0042" });
console.log("BR Code:", br);
ok("começa com payload format", br.slice(0, 6), "000201");
ok("tem o CRC no fim (63 04 + 4)", br.slice(-8, -4), "6304");
ok("valor 50.00 presente", br.includes("54055"), true);
ok("cidade cortada em 15", br.includes("6015ASSIS CHATEAU"), true);

// --- CPF ---
ok("CPF válido", validarCPF("52998224725"), true);
ok("CPF inválido", validarCPF("52998224724"), false);
ok("CPF repetido", validarCPF("11111111111"), false);

// --- idade na data do evento (o bug do fuso) ---
ok("faz 12 no dia do evento", idadeNaData("2014-10-17", "2026-10-17"), 12);
ok("faz 12 um dia depois", idadeNaData("2014-10-18", "2026-10-17"), 11);
ok("já tem 13", idadeNaData("2013-01-05", "2026-10-17"), 13);

// --- datas ---
ok("31/02 não existe", dataValida("2010-02-31"), false);
ok("29/02 de ano bissexto", dataValida("2012-02-29"), true);
ok("data futura recusada", dataValida("2030-01-01"), false);

// --- máscaras por tamanho: apagar no meio não pode embaralhar ---
ok("CPF completo", mascaraCPF("52998224725"), "529.982.247-25");
ok("CPF parcial", mascaraCPF("5299"), "529.9");
ok("CPF colado já formatado", mascaraCPF("529.982.247-25"), "529.982.247-25");
ok("CPF apagando o meio", mascaraCPF("529.982.2"), "529.982.2");
ok("data parcial", mascaraData("1710"), "17/10");
ok("data para ISO", dataParaISO("17/10/2014"), "2014-10-17");
ok("ISO incompleto vira vazio", dataParaISO("17/10"), "");

// --- telefone ---
ok("BR E.164", paraE164("(45) 99999-0000", "BR"), "+5545999990000");
ok("BR com DDI colado", paraE164("+55 45 99999-0000", "BR"), "+5545999990000");
ok("PY E.164", paraE164("0981 123456", "PY"), "+595981123456");
ok("incompleto vira null", paraE164("4599", "BR"), null);
ok("máscara BR", mascaraTelefone("45999990000", "BR"), "(45) 99999-0000");
ok("máscara reformatando texto já mascarado", mascaraTelefone("(45) 99999-0000", "BR"), "(45) 99999-0000");

// --- nome ---
ok("exige sobrenome", nomeCompleto("Ana"), false);
ok("inicial não conta", nomeCompleto("Ana A"), false);
ok("nome completo", nomeCompleto("Ana Souza"), true);
