import type { FastifyInstance } from "fastify";
import { PaymentProcessor } from "./payment-processor";

export default async function paymentRoutes(app: FastifyInstance) {
  const processor = new PaymentProcessor();

  app.post("/payments/charge", async (req, reply) => {
    const result = await processor.processPayment(req.body as any);
    return reply.send(result);
  });

  app.post("/payments/subscriptions/:id/cancel", async (req, reply) => {
    return reply.send({ ok: true });
  });

  app.post("/payments/subscriptions/:id/upgrade", async (req, reply) => {
    return reply.send({ ok: true });
  });
}
