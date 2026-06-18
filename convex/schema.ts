import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  canvas: defineTable({
    id: v.string(),
    pixels: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_canvasId", ["id"]),

  pixelHistory: defineTable({
    userId: v.string(),
    index: v.number(),
    color: v.string(),
    placedAt: v.number(),
  }).index("by_userId_placedAt", ["userId", "placedAt"]),
});
