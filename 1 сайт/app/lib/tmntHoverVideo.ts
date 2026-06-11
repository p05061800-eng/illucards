import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { TMNT_REFERENCE_POSTER_DIMENSIONS } from "./cardAspectRatio";

const FFMPEG_TIMEOUT_MS = 120_000;

const execFileAsync = promisify(execFile);

/**
 * Перекодирует короткий ролик в кадр 761×1024 (как фон TMNT), если в PATH есть `ffmpeg`.
 * При ошибке или отсутствии ffmpeg возвращает `null` — тогда сохраняют исходный файл.
 */
export async function tryTranscodeToTmntPosterMp4(
  inputBuffer: Buffer,
  ext: string,
): Promise<Buffer | null> {
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const tmpDir = os.tmpdir();
  const id = randomUUID();
  const inPath = path.join(tmpDir, `tmnt-hover-in-${id}${safeExt}`);
  const outPath = path.join(tmpDir, `tmnt-hover-out-${id}.mp4`);
  const { width: w, height: h } = TMNT_REFERENCE_POSTER_DIMENSIONS;
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  try {
    await fs.writeFile(inPath, inputBuffer);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inPath,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        outPath,
      ],
      {
        timeout: FFMPEG_TIMEOUT_MS,
        maxBuffer: 80 * 1024 * 1024,
      },
    );
    return await fs.readFile(outPath);
  } catch {
    return null;
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}
