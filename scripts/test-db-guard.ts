const PRODUCTION_PATTERNS = [
  /rds\.amazonaws\.com/,
  /neon\.tech/,
  /supabase/,
  /planetscale/,
  /railway\.app/,
  /render\.com/,
  /kahvem_prod/,
  /kahvemnerede(?!_test)/,
  /localhost:5432/,
  /localhost:5437/,
  /localhost:5440/,
];

export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" && !process.env.FORCE_TEST) {
    throw new Error("⛔ REFUSED: NODE_ENV=production. Set FORCE_TEST=1 to override.");
  }
  for (const pattern of PRODUCTION_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `⛔ REFUSED: DATABASE_URL matches production pattern ${pattern}. ` +
        `Set TEST_DATABASE_URL or E2E_DATABASE_URL to a test-only database.`
      );
    }
  }
  if (!url.includes("_test")) {
    throw new Error(
      "⛔ REFUSED: DATABASE_URL does not contain '_test'. " +
      "Use a test-only database with '_test' in the name."
    );
  }
}
