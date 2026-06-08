import { Router, type Request, type Response, type NextFunction } from "express";
import { db, paperTradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return;
  }
  next();
}

router.get("/trades", requireAuth, async (req, res) => {
  const trades = await db
    .select()
    .from(paperTradesTable)
    .where(eq(paperTradesTable.userId, req.session.userId!))
    .orderBy(paperTradesTable.createdAt);
  res.json(trades);
});

const tradeBodySchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  price: z.number().positive(),
  currency: z.string().default("USD"),
});

router.post("/trades", requireAuth, async (req, res) => {
  const parsed = tradeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인하세요." });
    return;
  }
  const { symbol, name, type, quantity, price, currency } = parsed.data;

  const [trade] = await db
    .insert(paperTradesTable)
    .values({
      userId: req.session.userId!,
      symbol,
      name,
      type,
      quantity: String(quantity),
      price: String(price),
      currency,
    })
    .returning();

  res.status(201).json(trade);
});

router.delete("/trades/:id", requireAuth, async (req, res) => {
  await db
    .delete(paperTradesTable)
    .where(
      and(
        eq(paperTradesTable.id, String(req.params.id)),
        eq(paperTradesTable.userId, req.session.userId!)
      )
    );
  res.json({ ok: true });
});

export default router;
