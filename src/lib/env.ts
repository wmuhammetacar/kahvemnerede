const WEAK_SECRETS = new Set([
  "change-me",
  "change-me-in-production",
  "change-me-in-production-please",
  "your-secret-here",
  "secret",
  "password",
  "super-secret",
  "jwt-secret",
  "test",
  "dev",
  "development",
  "admin",
  "changeme",
]);

let validated = false;

export function validateProductionEnv() {
  if (validated) return;
  validated = true;

  if (process.env.NODE_ENV === "production") {
    const secret = process.env.SESSION_SECRET ?? "";
    if (!secret || secret.length < 32) {
      console.error(
        "\n\nFATAL: SESSION_SECRET is missing or too short in production.\n" +
          "Set a strong SESSION_SECRET (>=32 chars) in your environment.\n\n"
      );
      process.exit(1);
    }
    if (WEAK_SECRETS.has(secret.toLowerCase())) {
      console.error(
        "\n\nFATAL: SESSION_SECRET is a known weak/default value in production.\n" +
          "Set a strong, unique SESSION_SECRET in your environment.\n\n"
      );
      process.exit(1);
    }
  }
}
