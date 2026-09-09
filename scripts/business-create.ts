#!/usr/bin/env node

/**
 * Onboarding CLI: Creates a new Business with first Branch and Admin user.
 *
 * Usage:
 *   pnpm business:create --business "Muse Coffee" --branch "Van AVM" --email admin@muse.test --password "SecureP@ss1"
 *
 * Or interactive mode:
 *   pnpm business:create
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { createBranchSlug } from "../src/lib/branch";
import argon2 from "argon2";
import * as readline from "readline";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseArgs(): Record<string, string> | null {
  const args = process.argv.slice(2);
  if (args.length === 0) return null;

  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const val = args[i + 1];
    if (key && val) parsed[key] = val;
  }
  return parsed;
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Şifre en az 8 karakter olmalı";
  if (!/[A-Z]/.test(password)) return "Şifre en az bir büyük harf içermeli";
  if (!/[a-z]/.test(password)) return "Şifre en az bir küçük harf içermeli";
  if (!/[0-9]/.test(password)) return "Şifre en az bir rakam içermeli";
  return null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const args = parseArgs();
  let businessName: string;
  let branchName: string;
  let adminEmail: string;
  let adminPassword: string;

  if (args) {
    businessName = args.business || "";
    branchName = args.branch || "";
    adminEmail = args.email || "";
    adminPassword = args.password || "";

    if (!businessName || !branchName || !adminEmail || !adminPassword) {
      console.error("Eksik parametre. Kullanım:");
      console.error(
        '  pnpm business:create --business "İşletme" --branch "Şube" --email admin@test.com --password "Sifre123"'
      );
      process.exit(1);
    }
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n=== Kahvem Nerede — İşletme Oluşturma ===\n");

    businessName = await ask(rl, "İşletme adı: ");
    branchName = await ask(rl, "İlk şube adı: ");
    adminEmail = await ask(rl, "Admin e-posta: ");

    while (true) {
      adminPassword = await ask(rl, "Admin şifresi (min 8 karakter, A-Z, a-z, 0-9): ");
      const error = validatePassword(adminPassword);
      if (!error) break;
      console.error(`  ✗ ${error}`);
    }

    rl.close();
  }

  if (!validateEmail(adminEmail)) {
    console.error("Geçersiz e-posta adresi");
    process.exit(1);
  }

  const passwordError = validatePassword(adminPassword);
  if (passwordError) {
    console.error(passwordError);
    process.exit(1);
  }

  const businessSlug = slugify(businessName);
  const branchSlug = createBranchSlug(`${businessSlug}-${slugify(branchName)}`);

  if (!businessSlug || !branchSlug) {
    console.error("Geçersiz isim — slug oluşturulamadı");
    process.exit(1);
  }

  console.log(`\nOluşturuluyor:`);
  console.log(`  İşletme: ${businessName} (${businessSlug})`);
  console.log(`  Şube:    ${branchName} (${branchSlug})`);
  console.log(`  Admin:   ${adminEmail}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check slug uniqueness
      const existingBusiness = await tx.business.findUnique({
        where: { slug: businessSlug },
      });
      if (existingBusiness) {
        throw new Error(`Bu işletme slug'ı zaten kullanımda: ${businessSlug}`);
      }

      const existingBranch = await tx.branch.findFirst({
        where: { slug: branchSlug },
      });
      if (existingBranch) {
        throw new Error(`Bu şube slug'ı zaten kullanımda: ${branchSlug}`);
      }

      const existingUser = await tx.user.findUnique({
        where: { email: adminEmail },
      });
      if (existingUser) {
        throw new Error(`Bu e-posta adresi zaten kayıtlı: ${adminEmail}`);
      }

      // Create business
      const business = await tx.business.create({
        data: {
          name: businessName,
          slug: businessSlug,
        },
      });

      // Create branch
      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: branchName,
          slug: branchSlug,
        },
      });

      // Create admin user
      const passwordHash = await argon2.hash(adminPassword);
      const admin = await tx.user.create({
        data: {
          branchId: branch.id,
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      return { business, branch, admin };
    });

    console.log(`\n✓ İşletme başarıyla oluşturuldu!\n`);
    console.log(`Business created: ${result.business.name}`);
    console.log(`Branch: ${result.branch.name}`);
    console.log(`Admin: ${result.admin.email}`);
    console.log(`\nTrack:  /b/${result.branch.slug}/track`);
    console.log(`Display: /b/${result.branch.slug}/display`);
    console.log(`\nPanel:  /panel`);
  } catch (error) {
    const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      ? "İşletme adresi, şube adresi veya e-posta zaten kullanımda. Farklı değerlerle tekrar deneyin."
      : error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error(`\n✗ Hata: ${message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
