import Link from "next/link";

export default function CardNotFound() {
  return (
    <main className="main flex min-h-0 flex-col items-center justify-center overflow-x-hidden bg-black px-6 py-24 text-center text-white">
      <p className="text-lg text-zinc-400">Карточка не найдена</p>
      <Link
        href="/#collection"
        className="mt-6 text-purple-400 underline-offset-4 transition-colors hover:text-purple-300 hover:underline"
      >
        Назад
      </Link>
    </main>
  );
}
