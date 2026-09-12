import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <img src="/juca/nao.webp" alt="" className="mx-auto w-32" />
      <h1 className="mt-4 text-3xl">Essa página não existe</h1>
      <p className="mt-2 text-apagado">
        O endereço pode ter mudado, ou a inscrição pertence a outra conta.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="botao-primario">
          Ir para o início
        </Link>
        <Link href="/minhas-inscricoes" className="botao-secundario">
          Minhas inscrições
        </Link>
      </div>
    </div>
  );
}
