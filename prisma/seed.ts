import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

// Demo seed policy:
// - NEVER runs implicitly. Requires explicit ENABLE_DEMO_SEED=true.
// - NEVER runs in production. Production bootstrap must use `pnpm business:create`.
// - No hardcoded passwords. Uses DEMO_PASSWORD when explicitly provided,
//   otherwise generates a random one-time password and prints it once.
// - Idempotent: upserts by slug/email, never resets existing passwords.

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Demo seed refuses to run with NODE_ENV=production. Use `pnpm business:create` instead.");
    process.exit(1);
  }
  if (process.env.ENABLE_DEMO_SEED !== "true") {
    console.log("Demo seed skipped. Set ENABLE_DEMO_SEED=true to create local demo data.");
    return;
  }

  const demoPassword = process.env.DEMO_PASSWORD ?? randomBytes(12).toString("base64url");
  const generated = process.env.DEMO_PASSWORD === undefined;
  const passwordHash = await argon2.hash(demoPassword);

  const business = await prisma.business.upsert({
    where: { slug: "kahvem-nerede" },
    update: {},
    create: { name: "Kahvem Nerede", slug: "kahvem-nerede" },
  });

  const branch = await prisma.branch.upsert({
    where: { slug: "ana-sube" },
    update: {},
    create: {
      businessId: business.id,
      name: "Ana Şube",
      slug: "ana-sube",
    },
  });

  for (const [email, role] of [["admin@kahvem.com", "ADMIN"], ["kasiyer@kahvem.com", "CASHIER"]] as const) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        branchId: branch.id,
        email,
        passwordHash,
        role,
      },
    });
  }

  console.log("Demo seed completed (idempotent).");
  if (generated) {
    console.log(`Demo password (one-time, store securely): ${demoPassword}`);
  } else {
    console.log("Demo password taken from DEMO_PASSWORD env.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
