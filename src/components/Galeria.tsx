import { createClient } from "@/lib/supabase/server";

/**
 * Fotos do bucket público `fotos`. Bucket público de propósito — aqui é foto
 * de evento, não comprovante. Comprovante mora no bucket privado e só sai por
 * signed URL.
 */
export async function Galeria({ limite = 12, eventoId }: { limite?: number; eventoId?: string }) {
  const supabase = await createClient();

  let consulta = supabase
    .from("galeria")
    .select("id, caminho, legenda")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (eventoId) consulta = consulta.eq("evento_id", eventoId);

  const { data: fotos } = await consulta;
  if (!fotos?.length) return null;

  const base = supabase.storage.from("fotos");

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h2 className="text-3xl">Galeria</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fotos.map((f) => (
          <li key={f.id} className="overflow-hidden rounded-[16px] border border-linha bg-white">
            <img
              src={base.getPublicUrl(f.caminho).data.publicUrl}
              alt={f.legenda ?? ""}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
