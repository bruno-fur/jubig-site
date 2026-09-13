import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { todosOsUsuarios } from "@/lib/usuarios";
import { ListaUsuarios } from "./ListaUsuarios";

export const metadata: Metadata = { title: "Usuários", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Usuarios() {
  await exigirAdmin();
  const usuarios = await todosOsUsuarios();
  return <ListaUsuarios usuarios={usuarios} />;
}
