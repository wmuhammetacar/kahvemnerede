import argon2 from "argon2";

export const PASSWORD_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 1 };
const DUMMY_HASH = "$argon2id$v=19$m=65536,p=4,t=3$pmkbIXPrqDD6lz0oAhBDVA$/MJxZSsRY6o6hf9M81Sxs1oWS0Eau+iG2+GQSojzRvk";

export async function verifyPassword(hash: string | undefined, password: string): Promise<boolean> {
  if (password.length < 1 || password.length > 128) return false;
  const encoded = hash || DUMMY_HASH;
  const parts = encoded.split("$");
  if (encoded.length > 512 || parts[1] !== "argon2id" || parts[2] !== "v=19") return false;
  const costs = Object.fromEntries((parts[3] || "").split(",").map((part) => part.split("=")));
  if (!["m", "t", "p"].every((key) => /^\d+$/.test(costs[key] || "")) ||
      Number(costs.m) > 65536 || Number(costs.t) > 3 || Number(costs.p) > 4) return false;
  try {
    const valid = await argon2.verify(encoded, password);
    return Boolean(hash) && valid;
  } catch {
    return false;
  }
}
