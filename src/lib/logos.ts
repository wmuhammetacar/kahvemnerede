import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import sharp from "sharp";
import { RequestError } from "./security";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_PREFIX = "/api/uploads/logos/";
const FILENAME = /^[a-zA-Z0-9_-]{1,128}-[a-f0-9]{64}\.png$/;

export function logoPath(filename: string): string | null {
  if (!FILENAME.test(filename)) return null;
  const directory = process.env.UPLOAD_DIR;
  if (!directory || !isAbsolute(directory)) throw new Error("UPLOAD_DIR must be an absolute persistent path");
  const publicRelative = relative(resolve(process.cwd(), "public"), resolve(directory));
  if (!publicRelative || (!publicRelative.startsWith(`..${sep}`) && publicRelative !== ".." && !isAbsolute(publicRelative))) {
    throw new Error("UPLOAD_DIR must be outside public");
  }
  return join(directory, filename);
}

export async function encodeLogo(bytes: Uint8Array): Promise<Buffer> {
  if (!bytes.byteLength || bytes.byteLength > MAX_LOGO_BYTES) throw new RequestError(400, "Invalid image size");
  const buffer = Buffer.from(bytes);
  const raster = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP");
  if (!raster) throw new RequestError(400, "Invalid PNG, JPEG or WEBP image");
  try {
    const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "warning", animated: false });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || "") || (metadata.pages || 1) !== 1) {
      throw new Error("Unsupported image");
    }
    // Re-encoding strips filenames, metadata and any executable trailing payload.
    return await image.rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new RequestError(400, "Invalid PNG, JPEG or WEBP image");
  }
}

export async function storeLogo(businessId: string, bytes: Uint8Array): Promise<string> {
  const encoded = await encodeLogo(bytes);
  const filename = `${businessId}-${randomBytes(32).toString("hex")}.png`;
  const filepath = logoPath(filename);
  if (!filepath) throw new Error("Invalid business ID");
  await mkdir(process.env.UPLOAD_DIR!, { recursive: true, mode: 0o700 });
  await writeFile(filepath, encoded, { flag: "wx", mode: 0o600 });
  return `${LOGO_PREFIX}${filename}`;
}

export async function removeLogo(url: string | null, businessId: string): Promise<void> {
  if (!url?.startsWith(LOGO_PREFIX)) return;
  const filename = url.slice(LOGO_PREFIX.length);
  if (!filename.startsWith(`${businessId}-`)) return;
  const filepath = logoPath(filename);
  if (!filepath) return;
  try {
    await unlink(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("Logo cleanup failed");
  }
}
