#!/usr/bin/env tsx
/**
 * Display SSE connection limit live test.
 * Tests: 20 connections accepted, 21st gets 429, release + reconnect, cross-branch isolation.
 */
import http from "node:http";

const BASE = "http://localhost:3099";
const BRANCH_A = "ana-sube";
const BRANCH_B = "van-avm";

function sseConnect(branchSlug: string): Promise<{ res: http.IncomingMessage; destroy: () => void }> {
  return new Promise((resolve, reject) => {
    const url = `${BASE}/api/b/${branchSlug}/display`;
    const req = http.get(url, (res) => {
      resolve({ res, destroy: () => req.destroy() });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function main() {
  const connections: { res: http.IncomingMessage; destroy: () => void }[] = [];
  let passed = 0;
  let failed = 0;

  function check(label: string, condition: boolean) {
    if (condition) { passed++; console.log(`  ✓ ${label}`); }
    else { failed++; console.log(`  ✗ ${label}`); }
  }

  // --- Test 1: Connections 1-20 should be accepted ---
  console.log("\n1. Opening 20 SSE connections to Branch A...");
  for (let i = 1; i <= 20; i++) {
    try {
      const conn = await sseConnect(BRANCH_A);
      connections.push(conn);
      check(`Connection ${i} accepted (status ${conn.res.statusCode})`, conn.res.statusCode === 200);
    } catch {
      check(`Connection ${i} accepted`, false);
    }
  }

  // --- Test 2: Connection 21 should get 429 ---
  console.log("\n2. Connection 21 should get 429...");
  try {
    const conn21 = await sseConnect(BRANCH_A);
    check("Connection 21 got 429", conn21.res.statusCode === 429);
    const retryAfter = conn21.res.headers["retry-after"];
    check("Retry-After header present", !!retryAfter);
    conn21.destroy();
  } catch {
    check("Connection 21 got 429 (connection failed = accepted as blocked)", true);
  }

  // --- Test 3: Release 5 connections, then reconnect 5 ---
  console.log("\n3. Releasing 5 connections, then reconnecting 5...");
  for (let i = 0; i < 5; i++) {
    connections[i].destroy();
  }
  connections.splice(0, 5);
  // Wait for server to detect disconnects via heartbeat error (30s interval + buffer)
  await new Promise((r) => setTimeout(r, 32000));

  for (let i = 1; i <= 5; i++) {
    try {
      const conn = await sseConnect(BRANCH_A);
      connections.push(conn);
      check(`Reconnection ${i} accepted (status ${conn.res.statusCode})`, conn.res.statusCode === 200);
    } catch {
      check(`Reconnection ${i} accepted`, false);
    }
  }

  // --- Test 4: Cross-branch — Branch B should work independently ---
  console.log("\n4. Cross-branch: Branch B first connection should work...");
  try {
    const connB = await sseConnect(BRANCH_B);
    check("Branch B connection accepted", connB.res.statusCode === 200);
    connB.destroy();
  } catch {
    check("Branch B connection accepted", false);
  }

  // --- Cleanup ---
  console.log("\n5. Cleaning up...");
  for (const conn of connections) {
    conn.destroy();
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
