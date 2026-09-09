import { PrismaClient } from "@prisma/client";
import { assertTestDatabase } from "../../scripts/test-db-guard";

// Production safety guard: never allow E2E global setup to run against production.
function assertNotProduction() {
  assertTestDatabase();
}

// Test isolation: E2E specs share one database and assert strict single-match
// locators (e.g. one "#184" row, empty display). Leftover ACTIVE orders from a
// previous run break strict mode and cascade into false failures, and COMPLETED
// rows accumulate in history. Wipe volatile tables before every run so the
// suite is reproducible. Seed/fixture users and branches are left untouched.
export default async function globalSetup() {
  assertNotProduction();

  const prisma = new PrismaClient();
  try {
    await prisma.order.deleteMany({});
    await prisma.loginAttempt.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
}
