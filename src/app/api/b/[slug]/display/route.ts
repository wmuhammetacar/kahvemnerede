import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventBus, acquireDisplayConnection, releaseDisplayConnection } from "@/lib/events";
import { findBranchBySlug } from "@/lib/branch";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const branch = await findBranchBySlug(slug);
  if (!branch) {
    return new Response("Not found", { status: 404 });
  }

  if (!acquireDisplayConnection(branch.id)) {
    return new Response(
      JSON.stringify({ error: "Çok fazla bağlantı. Lütfen kısa süre sonra tekrar deneyin." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "30" } }
    );
  }

  const encoder = new TextEncoder();

  const readyOrders = await prisma.order.findMany({
    where: { branchId: branch.id, status: "READY" },
    select: { orderNumber: true, readyAt: true },
    orderBy: { readyAt: "asc" },
  });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "init",
            orders: readyOrders.map((o) => ({ orderNumber: o.orderNumber })),
          })}\n\n`
        )
      );

      const channel = `display:ready:${branch.id}`;

      const unsubscribe = eventBus.subscribe(channel, (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          unsubscribe();
          releaseDisplayConnection(branch.id);
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
          releaseDisplayConnection(branch.id);
        }
      }, 30000);

      const originalCancel = controller.close.bind(controller);
      controller.close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        releaseDisplayConnection(branch.id);
        originalCancel();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
