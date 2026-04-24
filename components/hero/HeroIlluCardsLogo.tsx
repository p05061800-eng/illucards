import Link from "next/link";

/**
 * Логотип витрины: градиентный блик; при наведении увеличивается только та строка, на которую навели.
 */
export function HeroIlluCardsLogo() {
  return (
    <Link
      href="/"
      className="relative block max-w-full shrink-0 select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070510]"
      aria-label="IlluCards — на главную"
    >
      <span className="relative inline-block origin-left">
        <h1
          className="hero-wordmark-shine hero-scale-wordmark relative m-0 block origin-left font-bold tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.55),0_10px_36px_rgba(109,40,217,0.45),0_22px_48px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out hover:scale-[1.035] motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{ fontFeatureSettings: '"ss01" 1' }}
        >
          IlluCards
        </h1>
        <p className="site-text-muted hero-scale-tagline m-0 block origin-left font-medium uppercase tracking-[0.28em] transition-transform duration-300 ease-out hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
          коллекционные карточки
        </p>
      </span>
    </Link>
  );
}
