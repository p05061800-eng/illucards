export default function CardPageLoading() {
  return (
    <main className="main relative min-h-[70vh] overflow-x-hidden bg-black text-white">
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 pb-20 pt-8 sm:px-5 lg:px-8">
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="mx-auto aspect-[2/3] w-full max-w-[18rem] animate-pulse rounded-2xl bg-white/10 sm:max-w-[20rem]" />
        <div className="mx-auto h-7 w-2/3 max-w-md animate-pulse rounded bg-white/10" />
        <div className="mx-auto h-4 w-24 animate-pulse rounded bg-white/10" />
      </div>
    </main>
  );
}
