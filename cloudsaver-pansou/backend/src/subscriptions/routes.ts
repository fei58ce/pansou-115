import { Router, Request } from "express";
import { SubscriptionEngine } from "./engine";
import { SubscriptionEntry, SubscriptionRun } from "./models";
import { nextDaily } from "./rules";

function user(req: Request): string {
  const id = req.user?.userId;
  if (!id) throw new Error("请先登录");
  return id;
}
export function subscriptionRoutes(engine: SubscriptionEngine): Router {
  const router = Router();
  router.get("/", async (req, res) => {
    try {
      res.json({
        code: 0,
        data: await engine.list(user(req as Request)),
        schedule: "18:00 Asia/Shanghai",
        nextCheck: nextDaily().toISOString(),
      });
    } catch {
      res.status(500).json({ code: 1, message: "读取订阅失败" });
    }
  });
  router.get("/:id/history", async (req, res) => {
    try {
      const userId = user(req as Request);
      const id = String(req.params.id);
      await engine.owned(userId, id);
      res.json({
        code: 0,
        data: {
          runs: await SubscriptionRun.findAll({
            where: { userId, subscriptionId: id },
            order: [["createdAt", "DESC"]],
            limit: 30,
          }),
          entries: await SubscriptionEntry.findAll({
            where: { userId, subscriptionId: id },
            order: [["updatedAt", "DESC"]],
            limit: 100,
          }),
        },
      });
    } catch {
      res.status(404).json({ code: 1, message: "订阅不存在或无法读取" });
    }
  });
  router.post("/save", async (req, res) => {
    try {
      res.json({
        code: 0,
        data: await engine.save(
          user(req as Request),
          req.body,
          req.body.id ? String(req.body.id) : undefined
        ),
      });
    } catch (e) {
      res.json({
        code: 1,
        message:
          e instanceof Error && /^(?:115|[\u4e00-\u9fff])/.test(e.message)
            ? e.message
            : "保存失败，请检查目录与网络",
      });
    }
  });
  router.post("/:id/check", async (req, res) => {
    try {
      res.json({
        code: 0,
        data: await engine.enqueue(user(req as Request), String(req.params.id)),
      });
    } catch (e) {
      res.json({ code: 1, message: e instanceof Error ? e.message : "排队失败" });
    }
  });
  router.post("/:id/state", async (req, res) => {
    try {
      await engine.toggle(
        user(req as Request),
        String(req.params.id),
        req.body.enabled === true,
        req.body.archived === true
      );
      res.json({ code: 0, data: true });
    } catch (e) {
      res.json({
        code: 1,
        message:
          e instanceof Error && /^(?:115|[\u4e00-\u9fff])/.test(e.message)
            ? e.message
            : "状态更新失败",
      });
    }
  });
  return router;
}
