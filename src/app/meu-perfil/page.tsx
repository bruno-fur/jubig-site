import type { Metadata } from "next";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { exigirLogin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { igrejasParaEscolha } from "@/lib/eventos";
import { FormularioPerfil } from "./FormularioPerfil";

export const metadata: Metadata = { title: "Meu perfil", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MeuPerfil() {
  const sessao = await exigirLogin();
  const supabase = await createClient();

  const [{ data: perfil }, igrejas] = await Promise.all([
    supabase.from("perfis").select("nome, telefone, igreja, igreja_id").eq("id", sessao.userId).maybeSingle(),
    igrejasParaEscolha(),
  ]);

  // O banco guarda E.164; o campo mostra país + número nacional com máscara.
  const tel = perfil?.telefone ? parsePhoneNumberFromString(perfil.telefone) : undefined;
  const igrejaNaLista = igrejas.some((i) => i.id === perfil?.igreja_id);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl">Meu perfil</h1>
      <p className="mt-2 text-apagado">
        Estes dados vêm preenchidos na próxima inscrição. Inscrições já feitas não mudam.
      </p>

      <FormularioPerfil
        email={sessao.email}
        igrejas={igrejas}
        inicial={{
          nome: perfil?.nome ?? sessao.nome ?? "",
          telefoneNacional: tel?.nationalNumber ?? "",
          pais: ((tel?.country as CountryCode | undefined) ?? "BR"),
          igrejaId: igrejaNaLista ? perfil!.igreja_id! : "",
          // Igreja digitada antes da lista existir: mostra para a pessoa escolher a certa.
          igrejaAntiga: !igrejaNaLista && perfil?.igreja ? perfil.igreja : null,
        }}
      />
    </div>
  );
}
