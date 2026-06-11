const SOUND_SRC = "/sounds/cart-click.wav";

let clickAudio: HTMLAudioElement | null = null;

/**
 * Короткий звук при добавлении в корзину (HTMLAudioElement + сброс currentTime).
 */
export function playClick(): void {
  if (typeof window === "undefined") return;

  if (!clickAudio) {
    clickAudio = new Audio(SOUND_SRC);
    clickAudio.volume = 0.34;
    clickAudio.preload = "auto";
  }

  clickAudio.currentTime = 0;
  void clickAudio.play().catch(() => {
    /* автовоспроизведение может быть заблокировано до жеста пользователя */
  });
}
