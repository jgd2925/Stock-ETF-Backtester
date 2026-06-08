import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/auth/signup", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email: email.toLowerCase(), passwordHash })
    .returning();

  req.session.userId = user.id;
  req.session.email = user.email;
  res.json({ id: user.id, email: user.email });
});

router.post("/auth/signin", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "이메일 또는 비밀번호를 확인하세요." });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  req.session.userId = user.id;
  req.session.email = user.email;
  res.json({ id: user.id, email: user.email });
});

router.post("/auth/signout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return;
  }
  res.json({ id: req.session.userId, email: req.session.email });
});

export default router;
