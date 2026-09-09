import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface AuditLogEntry {
  businessId: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonObject;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: entry.businessId,
        actorId: entry.actorId || null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId || null,
        metadata: entry.metadata || undefined,
      },
    });
  } catch {
    // Audit log failure should not block the operation
  }
}

export const AUDIT_ACTIONS = {
  USER_CREATED: "user.created",
  USER_DISABLED: "user.disabled",
  USER_ENABLED: "user.enabled",
  USER_BRANCH_REASSIGNED: "user.branch_reassigned",
  PASSWORD_CHANGED: "password.changed",
  PASSWORD_FORCE_CHANGED: "password.force_changed",
  BUSINESS_SETTINGS_CHANGED: "business.settings_changed",
  BUSINESS_LOGO_UPLOADED: "business.logo_uploaded",
  BUSINESS_CREATED: "business.created",
} as const;
