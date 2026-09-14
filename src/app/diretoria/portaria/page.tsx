import { redirect } from "next/navigation";

/** A portaria virou Validação. Endereço antigo continua valendo para quem salvou o atalho. */
export default function Portaria() {
  redirect("/diretoria/validacao");
}
