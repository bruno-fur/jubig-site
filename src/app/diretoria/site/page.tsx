import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { estadoInstagram } from "@/lib/instagram";
import { FormularioSite } from "./FormularioSite";
import { ConexaoInstagram } from "./ConexaoInstagram";

export const metadata: Metadata = { title: "Site", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Contatos, textos e Instagram: o que antes só mudava com deploy. */
export default async function Site() {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ data: linha }, config, instagram] = await Promise.all([
    supabase.from("configuracoes").select("id").eq("id", 1).maybeSingle(),
    lerConfiguracoes(),
    estadoInstagram(),
  ]);

  return (
    <div className="space-y-8">
      {!linha && (
        <p role="alert" className="rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
          A tabela de configurações ainda não existe no banco. Rode o supabase/schema.sql no SQL Editor
          antes de salvar.
        </p>
      )}

      <FormularioSite
        inicial={{
          whatsapp: config.whatsapp,
          instagram: config.instagram,
          emailContato: config.emailContato ?? "",
          quemSomos: config.quemSomos ?? "",
        }}
      />

      <ConexaoInstagram
        conectado={instagram.conectado}
        usuario={instagram.usuario}
        atualizadoEm={instagram.atualizadoEm}
        tokenExpiraEm={instagram.tokenExpiraEm}
        erro={instagram.erro}
        previa={instagram.postagens.slice(0, 6).map((p) => ({ id: p.id, imagem: p.imagem, link: p.link }))}
      />
    </div>
  );
}
