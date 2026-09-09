import { describe, it, expect } from "vitest";
import {
  loginSchema,
  orderCreateSchema,
  trackSchema,
} from "@/lib/validations";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("orderCreateSchema", () => {
  it("accepts valid numeric order number", () => {
    const result = orderCreateSchema.safeParse({ orderNumber: "184" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace", () => {
    const result = orderCreateSchema.safeParse({ orderNumber: "  184  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderNumber).toBe("184");
    }
  });

  it("rejects empty string", () => {
    const result = orderCreateSchema.safeParse({ orderNumber: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric characters", () => {
    const result = orderCreateSchema.safeParse({ orderNumber: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects mixed characters", () => {
    const result = orderCreateSchema.safeParse({ orderNumber: "184a" });
    expect(result.success).toBe(false);
  });

  it("rejects too long input", () => {
    const result = orderCreateSchema.safeParse({
      orderNumber: "12345678901",
    });
    expect(result.success).toBe(false);
  });

  it("accepts single digit", () => {
    const result = orderCreateSchema.safeParse({ orderNumber: "1" });
    expect(result.success).toBe(true);
  });
});

describe("trackSchema", () => {
  it("accepts valid order number", () => {
    const result = trackSchema.safeParse({ orderNumber: "184" });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric", () => {
    const result = trackSchema.safeParse({ orderNumber: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects empty", () => {
    const result = trackSchema.safeParse({ orderNumber: "" });
    expect(result.success).toBe(false);
  });
});
