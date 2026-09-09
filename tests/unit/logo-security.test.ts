import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const files = vi.hoisted(() => ({ mkdir: vi.fn(), unlink: vi.fn(), writeFile: vi.fn() }));
vi.mock("node:fs/promises", () => files);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { encodeLogo, logoPath, MAX_LOGO_BYTES, removeLogo, storeLogo } from "@/lib/logos";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("UPLOAD_DIR", "/tmp/opencode/logo-security-tests");
});

describe("safe raster logos", () => {
  it("rejects paths, extensions and legacy public URLs without deleting anything", async () => {
    for (const filename of ["../../secret", "logo.svg", "logo.html", `%2e%2e%2fsecret`, `biz-${"a".repeat(64)}.png/../secret`]) {
      expect(logoPath(filename)).toBeNull();
    }
    for (const url of ["/uploads/logos/old.png", "/../../secret", `https://evil.test/logo.png`, `/api/uploads/logos/other-${"a".repeat(64)}.png`]) {
      await removeLogo(url, "biz");
    }
    expect(files.unlink).not.toHaveBeenCalled();
  });

  it("deletes only the current business's managed filename", async () => {
    const filename = `biz-${"a".repeat(64)}.png`;
    await removeLogo(`/api/uploads/logos/${filename}`, "biz");
    expect(files.unlink).toHaveBeenCalledExactlyOnceWith(`/tmp/opencode/logo-security-tests/${filename}`);
  });

  it("requires absolute storage outside Next public", () => {
    const filename = `biz-${"a".repeat(64)}.png`;
    vi.stubEnv("UPLOAD_DIR", "relative/uploads");
    expect(() => logoPath(filename)).toThrow("absolute persistent path");
    vi.stubEnv("UPLOAD_DIR", `${process.cwd()}/public/uploads`);
    expect(() => logoPath(filename)).toThrow("outside public");
  });

  it.each([
    "<html><script>alert(1)</script></html>",
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>',
    "not an image",
  ])("rejects executable or malformed input: %s", async (input) => {
    await expect(encodeLogo(Buffer.from(input))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects excessive bytes and pixels", async () => {
    await expect(encodeLogo(Buffer.alloc(MAX_LOGO_BYTES + 1))).rejects.toMatchObject({ status: 400 });
    const image = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: "white" } }).png().toBuffer();
    await expect(encodeLogo(image)).rejects.toMatchObject({ status: 400 });
  });

  it("reencodes rasters, removes trailing scripts and uses only random PNG names", async () => {
    const original = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).jpeg().toBuffer();
    const input = Buffer.concat([original, Buffer.from("<script>evil()</script>")]);
    const output = await encodeLogo(input);
    expect((await sharp(output).metadata()).format).toBe("png");
    expect(output.includes(Buffer.from("<script>"))).toBe(false);
    const url = await storeLogo("biz", input);
    expect(url).toMatch(/^\/api\/uploads\/logos\/biz-[a-f0-9]{64}\.png$/);
    expect(files.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/biz-[a-f0-9]{64}\.png$/),
      expect.any(Buffer),
      { flag: "wx", mode: 0o600 },
    );
  });
});
