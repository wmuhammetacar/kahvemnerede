import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(128),
});

export const orderCreateSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(1, "Sipariş numarası gerekli")
    .max(10, "Sipariş numarası çok uzun")
    .regex(/^\d+$/, "Yalnızca rakam olmalı"),
});

export const trackSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(1, "Sipariş numarası gerekli")
    .max(10)
    .regex(/^\d+$/, "Yalnızca rakam olmalı"),
});

export const staffCreateSchema = z.object({
  email: z.string().trim().max(254).email("Geçersiz e-posta adresi"),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .max(128, "Şifre çok uzun")
    .regex(/[A-Z]/, "Şifre en az bir büyük harf içermeli")
    .regex(/[a-z]/, "Şifre en az bir küçük harf içermeli")
    .regex(/[0-9]/, "Şifre en az bir rakam içermeli"),
  role: z.enum(["ADMIN", "CASHIER"]),
  branchId: z.string().min(1, "Şube seçilmeli").max(128),
});

export const staffUpdateSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["ADMIN", "CASHIER"]).optional(),
  branchId: z.string().min(1).max(128).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Geçersiz veri");

export const businessSettingsSchema = z.object({
  name: z.string().trim().min(1, "İşletme adı gerekli").max(100).optional(),
  primaryColor: z
    .enum([
      "ESPRESSO",
      "FOREST",
      "BURGUNDY",
      "NAVY",
      "AMBER",
      "STONE",
    ])
    .nullable()
    .optional(),
  trackingTitle: z.string().max(100).nullable().optional(),
  readyMessage: z.string().max(200).nullable().optional(),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli").max(128),
  newPassword: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .max(128, "Şifre çok uzun")
    .regex(/[A-Z]/, "Şifre en az bir büyük harf içermeli")
    .regex(/[a-z]/, "Şifre en az bir küçük harf içermeli")
    .regex(/[0-9]/, "Şifre en az bir rakam içermeli"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type TrackInput = z.infer<typeof trackSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
