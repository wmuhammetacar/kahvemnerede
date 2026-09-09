#!/usr/bin/env tsx
/**
 * Seed test database with fixtures for E2E + integration tests.
 * Run: npx tsx scripts/test-seed.ts
 *
 * Required env:
 *   DATABASE_URL  – must point to *_test database
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { assertTestDatabase } from "./test-db-guard";

assertTestDatabase();

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test database...");

  const passwordHash = await argon2.hash("password123");

  // --- Business A (used by full-flow, cross-tenant) ---
  const bizA = await prisma.business.upsert({
    where: { slug: "test-business-a" },
    update: {},
    create: { name: "Test Business A", slug: "test-business-a" },
  });

  const branchA1 = await prisma.branch.upsert({
    where: { slug: "ana-sube" },
    update: {},
    create: { businessId: bizA.id, name: "Ana Şube", slug: "ana-sube" },
  });

  await prisma.user.upsert({
    where: { email: "admin@kahvem.com" },
    update: {},
    create: {
      branchId: branchA1.id,
      email: "admin@kahvem.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  // --- Business B (used by reports.spec.ts) ---
  const bizB = await prisma.business.upsert({
    where: { slug: "test-business-b" },
    update: {},
    create: { name: "Test Business B", slug: "test-business-b" },
  });

  const branchB1 = await prisma.branch.upsert({
    where: { slug: "van-avm" },
    update: {},
    create: { businessId: bizB.id, name: "Van AVM", slug: "van-avm" },
  });

  const branchB2 = await prisma.branch.upsert({
    where: { slug: "iskele" },
    update: {},
    create: { businessId: bizB.id, name: "Iskele", slug: "iskele" },
  });

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: {
      branchId: branchB1.id,
      email: "admin@test.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "cashier@test.com" },
    update: {},
    create: {
      branchId: branchB1.id,
      email: "cashier@test.com",
      passwordHash,
      role: "CASHIER",
    },
  });

  console.log("Fixtures seeded:");
  console.log(`  Business A: ${bizA.id} (slug: ${bizA.slug})`);
  console.log(`    Branch: Ana Şube (${branchA1.slug})`);
  console.log(`    Admin: admin@kahvem.com`);
  console.log(`  Business B: ${bizB.id} (slug: ${bizB.slug})`);
  console.log(`    Branch: Van AVM (${branchB1.slug})`);
  console.log(`    Branch: Iskele (${branchB2.slug})`);
  console.log(`    Admin: admin@test.com`);
  console.log(`    Cashier: cashier@test.com`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
