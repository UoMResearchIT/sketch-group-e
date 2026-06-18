import { v } from "convex/values";
import {
  type MutationCtx,
  type QueryCtx,
  mutation,
  query,
} from "./_generated/server";

const CANVAS_ID = "canvas_main";
const CANVAS_SIZE = 50;
const CANVAS_COLOR = "#000000";

const pixelChangeValidator = v.object({
  index: v.number(),
  color: v.string(),
});

async function findCanvas(ctx: QueryCtx | MutationCtx) {
  const byId = await ctx.db
    .query("canvas")
    .withIndex("by_canvasId", (q) => q.eq("id", CANVAS_ID))
    .first();
  if (byId) return byId;
  return await ctx.db.query("canvas").first();
}

export const getCanvas = query({
  args: {},
  handler: async (ctx) => {
    return await findCanvas(ctx);
  },
});

export const ensureCanvas = mutation({
  args: {},
  handler: async (ctx) => {
    const canvas = await findCanvas(ctx);
    if (!canvas) {
      const pixels = Array(CANVAS_SIZE * CANVAS_SIZE).fill(CANVAS_COLOR);
      const id = await ctx.db.insert("canvas", {
        id: CANVAS_ID,
        pixels,
        updatedAt: Date.now(),
      });
      return await ctx.db.get("canvas", id);
    }
    return canvas;
  },
});

async function applyPixelChanges(
  ctx: MutationCtx,
  userId: string,
  changes: { index: number; color: string }[],
) {
  if (changes.length === 0) {
    return { success: true, applied: 0 };
  }

  const canvas = await findCanvas(ctx);
  if (!canvas) {
    throw new Error("Canvas not found");
  }

  const pixels = [...canvas.pixels];
  const now = Date.now();
  let applied = 0;

  for (const change of changes) {
    if (change.index < 0 || change.index >= pixels.length) {
      throw new Error("Index out of bounds");
    }
    if (pixels[change.index] === change.color) {
      continue;
    }
    pixels[change.index] = change.color;
    applied++;
    await ctx.db.insert("pixelHistory", {
      userId,
      index: change.index,
      color: change.color,
      placedAt: now,
    });
  }

  if (applied > 0) {
    await ctx.db.patch(canvas._id, {
      pixels,
      updatedAt: now,
    });
  }

  return { success: true, applied };
}

export const paintPixels = mutation({
  args: {
    userId: v.string(),
    changes: v.array(pixelChangeValidator),
  },
  handler: async (ctx, args) => {
    return await applyPixelChanges(ctx, args.userId, args.changes);
  },
});

export const paintPixel = mutation({
  args: {
    userId: v.string(),
    index: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    return await applyPixelChanges(ctx, args.userId, [
      { index: args.index, color: args.color },
    ]);
  },
});

export const clearCanvas = mutation({
  args: {
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const canvas = await findCanvas(ctx);
    if (!canvas) {
      throw new Error("Canvas not found");
    }
    const color = args.color ?? CANVAS_COLOR;
    const pixels = Array(CANVAS_SIZE * CANVAS_SIZE).fill(color);
    await ctx.db.patch(canvas._id, {
      pixels,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
