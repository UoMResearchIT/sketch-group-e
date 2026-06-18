"use client";

import {
  CANVAS_SIZE,
  drawFullCanvas,
  drawPixelOnCanvas,
} from "@/app/_canvas/canvas-pixels";
import { useSessionUserId } from "@/app/_canvas/use-session-user-id";
import { useTheme } from "@/app/_canvas/use-theme";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Grid,
  Hand,
  History,
  Info,
  Maximize,
  Moon,
  MousePointer,
  Paintbrush,
  Palette,
  Pipette,
  Sparkles,
  Sun,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Preset colors for the palette (standard pixel art colors)
const PRESET_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#a855f7", // Violet
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ffffff", // White
  "#94a3b8", // Slate
  "#475569", // Dark Slate
  "#000000", // Black
];

interface PaintLog {
  x: number;
  y: number;
  color: string;
  time: string;
}

export default function Canvas() {
  // Convex queries and mutations
  const sessionUserId = useSessionUserId();
  const canvasData = useQuery(api.canvas.getCanvas);
  const paintPixels = useMutation(api.canvas.paintPixels);
  const clearCanvas = useMutation(api.canvas.clearCanvas);
  const ensureCanvas = useMutation(api.canvas.ensureCanvas);

  // Canvas state — optimistic updates while drawing, otherwise derive from server
  const [optimisticPixels, setOptimisticPixels] = useState<string[] | null>(
    null,
  );
  const localPixels = useMemo(
    () => optimisticPixels ?? canvasData?.pixels ?? null,
    [optimisticPixels, canvasData?.pixels],
  );
  const [selectedColor, setSelectedColor] = useState<string>("#ef4444");
  const [activeTool, setActiveTool] = useState<
    "pen" | "eraser" | "picker" | "hand"
  >("pen");
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(10);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [spacePressed, setSpacePressed] = useState<boolean>(false);

  // Stats & Log states
  const [hoveredCoord, setHoveredCoord] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [paintHistory, setPaintHistory] = useState<PaintLog[]>([]);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  // References
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pixelsRef = useRef<string[] | null>(null);
  const pendingChangesRef = useRef<Map<number, string>>(new Map());
  const lastFlushAtRef = useRef(0);
  const flushInFlightRef = useRef(false);

  // Initialize canvas if it doesn't exist
  useEffect(() => {
    ensureCanvas();
  }, [ensureCanvas]);

  // Open sidebar by default on large screens; drawer on mobile
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsSidebarOpen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Keyboard listeners for space-drag and hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        setSpacePressed(true);
        e.preventDefault();
      }

      // Hotkeys
      switch (e.key.toLowerCase()) {
        case "b":
        case "p":
          setActiveTool("pen");
          break;
        case "e":
          setActiveTool("eraser");
          break;
        case "i":
          setActiveTool("picker");
          break;
        case "h":
          setActiveTool("hand");
          break;
        case "g":
          setShowGrid((prev) => !prev);
          break;
        case "r":
          // Reset zoom and center
          setZoom(10);
          setPan({ x: 0, y: 0 });
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    pixelsRef.current = localPixels;
  }, [localPixels]);

  const flushPendingChanges = useCallback(async (): Promise<boolean> => {
    if (!sessionUserId) {
      setSyncError("Session not ready — refresh the page.");
      return false;
    }
    if (pendingChangesRef.current.size === 0) return true;
    if (flushInFlightRef.current) return false;

    const changes = Array.from(pendingChangesRef.current.entries()).map(
      ([index, color]) => ({ index, color }),
    );
    pendingChangesRef.current.clear();
    flushInFlightRef.current = true;
    lastFlushAtRef.current = Date.now();

    try {
      await paintPixels({ userId: sessionUserId, changes });
      setSyncError(null);
      return true;
    } catch (err) {
      console.error("Failed to sync pixels:", err);
      setSyncError(
        err instanceof Error ? err.message : "Failed to sync with Convex",
      );
      for (const change of changes) {
        pendingChangesRef.current.set(change.index, change.color);
      }
      return false;
    } finally {
      flushInFlightRef.current = false;
    }
  }, [paintPixels, sessionUserId]);

  // Full redraw from server when idle (avoid repainting entire grid on every stroke pixel)
  useEffect(() => {
    if (!canvasData?.pixels || !canvasRef.current) return;
    if (optimisticPixels || isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    drawFullCanvas(ctx, canvasData.pixels);
    pixelsRef.current = canvasData.pixels;
  }, [canvasData?.pixels, optimisticPixels, isDrawing]);

  // Flush batched strokes while dragging so collaborators see updates sooner
  useEffect(() => {
    if (!isDrawing) return;
    const interval = window.setInterval(() => {
      void flushPendingChanges();
    }, 200);
    return () => window.clearInterval(interval);
  }, [isDrawing, flushPendingChanges]);

  // Compute statistics about pixel canvas
  const stats = useMemo(() => {
    if (!localPixels) {
      return {
        totalPainted: 0,
        percent: "0.0",
        popularColor: "#ef4444",
        colorCounts: [],
      };
    }
    const counts: Record<string, number> = {};
    let totalPainted = 0;

    localPixels.forEach((color: string) => {
      const lowerColor = color.toLowerCase();
      // Assume #000000 is default background (unpainted)
      if (lowerColor !== "#000000") {
        totalPainted++;
      }
      counts[color] = (counts[color] || 0) + 1;
    });

    const percent = ((totalPainted / 2500) * 100).toFixed(1);

    // Get color distribution ranking
    const sortedColors = Object.entries(counts)
      .map(([color, count]) => ({
        color,
        count,
        pct: ((count / 2500) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);

    // Popular color is the highest count non-black color
    const popularColor =
      sortedColors.find((c) => c.color.toLowerCase() !== "#000000")?.color ||
      "#ef4444";

    return {
      totalPainted,
      percent,
      popularColor,
      colorCounts: sortedColors.slice(0, 5),
    };
  }, [localPixels]);

  // Handle zooming using scroll wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    const newZoom =
      e.deltaY < 0
        ? Math.min(zoom * zoomFactor, 35)
        : Math.max(zoom / zoomFactor, 2);

    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasMouseX = mouseX - pan.x;
      const canvasMouseY = mouseY - pan.y;

      const scaleRatio = newZoom / zoom;

      setPan({
        x: mouseX - canvasMouseX * scaleRatio,
        y: mouseY - canvasMouseY * scaleRatio,
      });
    }
    setZoom(newZoom);
  };

  const applyLocalPixel = useCallback(
    (index: number, color: string, x: number, y: number) => {
      const base = pixelsRef.current;
      if (!base || base[index] === color) return;

      const updated = [...base];
      updated[index] = color;
      pixelsRef.current = updated;
      setOptimisticPixels(updated);

      const canvasEl = canvasRef.current;
      if (canvasEl) {
        if (canvasEl.width !== CANVAS_SIZE) {
          canvasEl.width = CANVAS_SIZE;
          canvasEl.height = CANVAS_SIZE;
          const setupCtx = canvasEl.getContext("2d");
          if (setupCtx) drawFullCanvas(setupCtx, updated);
        } else {
          const ctx = canvasEl.getContext("2d");
          if (ctx) drawPixelOnCanvas(ctx, index, color);
        }
      }

      pendingChangesRef.current.set(index, color);

      setPaintHistory((prev) => [
        {
          x,
          y,
          color,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...prev.slice(0, 19),
      ]);
    },
    [],
  );

  // Perform drawing or picking action
  const drawOrPickPixel = (
    clientX: number,
    clientY: number,
    isInitialClick: boolean = false,
  ) => {
    const currentPixels = pixelsRef.current;
    if (!canvasRef.current || !currentPixels) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / zoom);
    const y = Math.floor((clientY - rect.top) / zoom);

    if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
      const index = y * CANVAS_SIZE + x;
      const color = activeTool === "eraser" ? "#000000" : selectedColor;

      if (activeTool === "picker") {
        if (isInitialClick) {
          const picked = currentPixels[index];
          setSelectedColor(picked);
          setActiveTool("pen");
        }
        return;
      }

      applyLocalPixel(index, color, x, y);
    }
  };

  // Handle Mouse interaction triggers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddleClick = e.button === 1;
    const shouldPan = activeTool === "hand" || isMiddleClick || spacePressed;

    if (shouldPan) {
      setIsPanning(true);
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
      e.preventDefault();
    } else {
      setIsDrawing(true);
      drawOrPickPixel(e.clientX, e.clientY, true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (isDrawing) {
      drawOrPickPixel(e.clientX, e.clientY);
    }

    // Hovered coordinate calculation
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / zoom);
      const y = Math.floor((e.clientY - rect.top) / zoom);
      if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
        setHoveredCoord({ x, y });
      } else {
        setHoveredCoord(null);
      }
    }
  };

  const endStroke = useCallback(async () => {
    setIsPanning(false);
    setIsDrawing(false);
    await flushPendingChanges();
    setOptimisticPixels(null);
  }, [flushPendingChanges]);

  const handleMouseUp = () => {
    endStroke();
  };

  // Handle Touch interactions (Mobile)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const isMultiTouch = e.touches.length > 1;
    const shouldPan = activeTool === "hand" || isMultiTouch;

    if (shouldPan) {
      setIsPanning(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    } else {
      setIsDrawing(true);
      drawOrPickPixel(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPanning && e.touches.length > 0) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (isDrawing && e.touches.length > 0) {
      drawOrPickPixel(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    endStroke();
  };

  // Clear Canvas handler
  const handleClearCanvas = async () => {
    setIsConfirmingClear(false);
    pendingChangesRef.current.clear();
    setOptimisticPixels(null);
    try {
      await clearCanvas({ color: "#000000" });
      setPaintHistory([]);
    } catch (err) {
      console.error("Failed to clear canvas:", err);
    }
  };

  // Export Canvas as scale-up sharp PNG
  const exportCanvas = () => {
    if (!localPixels) return;
    const size = 50;
    const exportScale = 16; // 50x50 -> 800x800 crisp PNG
    const eCanvas = document.createElement("canvas");
    eCanvas.width = size * exportScale;
    eCanvas.height = size * exportScale;
    const ctx = eCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        ctx.fillStyle = localPixels[idx];
        ctx.fillRect(
          x * exportScale,
          y * exportScale,
          exportScale,
          exportScale,
        );
      }
    }

    const url = eCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `canvas_convex_rplace_${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  const sessionLabel = sessionUserId ? `${sessionUserId.slice(0, 8)}…` : "…";

  const gridLineColor =
    theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";

  // Loading state overlay
  if (!localPixels) {
    const isConnecting = canvasData === undefined;
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="relative flex flex-col items-center gap-6 max-w-md px-6 text-center">
          <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
          <div className="relative h-16 w-16 animate-spin rounded-full border-4 border-indigo-500/10 border-t-indigo-500" />
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-medium text-zinc-800 dark:text-zinc-200">
              {isConnecting ? "Connecting to Convex" : "Waiting for canvas"}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-500">
              {isConnecting
                ? "Start the backend with: npx convex dev"
                : "Canvas document is being created…"}
            </p>
            {!process.env.NEXT_PUBLIC_CONVEX_URL && (
              <p className="text-sm text-amber-400/90 mt-2">
                Missing NEXT_PUBLIC_CONVEX_URL — copy .env.local from the
                project or run npx convex dev once.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dynamic cursor styling based on selected tool and spacebar drag state
  const cursorStyle =
    spacePressed || isPanning
      ? "cursor-grabbing"
      : activeTool === "hand"
        ? "cursor-grab"
        : activeTool === "picker"
          ? "cursor-cell"
          : "cursor-crosshair";

  return (
    <div className="relative flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-zinc-50 text-zinc-900 font-sans antialiased select-none dark:bg-zinc-950 dark:text-zinc-100">
      {/* Background grid decoration */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_85%_85%_at_50%_15%,rgba(99,102,241,0.14),rgba(0,0,0,0))] dark:bg-[radial-gradient(ellipse_85%_85%_at_50%_15%,rgba(99,102,241,0.12),rgba(0,0,0,0))]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)]" />

      {syncError && (
        <div className="absolute top-14 sm:top-16 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-800 shadow-lg dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-200">
          {syncError}
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white/80 px-3 backdrop-blur-md z-20 sm:h-16 sm:px-4 lg:px-6 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="truncate bg-linear-to-r from-zinc-900 via-indigo-700 to-indigo-500 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-xl dark:from-zinc-100 dark:via-indigo-200 dark:to-indigo-400">
              r/place{" "}
              <span className="text-indigo-600 font-medium text-xs px-1 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 ml-0.5 sm:text-sm sm:px-1.5 sm:py-0.5 sm:ml-1 dark:text-indigo-400">
                Convex
              </span>
            </h1>
          </div>
          <div className="hidden h-5 w-px bg-zinc-300 md:block dark:bg-zinc-800" />
          <div className="hidden items-center gap-2 text-xs md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {syncError ? "Sync error" : "Live · batched sync"}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100/80 px-2 py-1 font-mono text-[10px] text-zinc-600 lg:flex dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-500">
            <span className="text-zinc-500 dark:text-zinc-600">session</span>
            <span
              className="text-indigo-600 dark:text-indigo-300"
              title={sessionUserId ?? undefined}
            >
              {sessionLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-9 w-9  items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 lg:hidden dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Color palette & stats"
            aria-label="Open palette and stats"
          >
            <Palette className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            aria-label="Toggle light and dark mode"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={exportCanvas}
            className="flex items-center gap-2 cursor-pointer rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 sm:px-3 dark:border-zinc-700/60 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-white"
            title="Download sharp png export"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export PNG</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmingClear(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 sm:px-3 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
            title="Reset all pixels to black"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear Grid</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Mobile drawer backdrop */}
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close sidebar"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Tools tray — bottom bar on mobile, left rail on desktop */}
        <div className="absolute bottom-[4.5rem] left-1/2 z-10 flex -translate-x-1/2 flex-row gap-1 rounded-2xl border border-zinc-200 bg-white/90 p-1.5 shadow-2xl backdrop-blur-md sm:bottom-20 md:left-6 md:top-1/2 md:bottom-auto md:flex-col md:gap-2 md:p-2.5 md:-translate-y-1/2 md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="hidden text-[10px] font-bold text-zinc-500 tracking-wider text-center pb-1 border-b border-zinc-200 md:block dark:border-zinc-800">
            TOOLS
          </div>

          {/* Pen / Brush */}
          <button
            onClick={() => setActiveTool("pen")}
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all relative group cursor-pointer ${
              activeTool === "pen"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-500/40"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
            title="Pen Tool (B / P)"
          >
            <Paintbrush className="h-5 w-5" />
            <span className="absolute left-14 hidden group-hover:block rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-700 border border-zinc-200 whitespace-nowrap shadow-md dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              Pen (B)
            </span>
          </button>

          {/* Eraser */}
          <button
            onClick={() => setActiveTool("eraser")}
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all relative group cursor-pointer ${
              activeTool === "eraser"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-500/40"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
            title="Eraser (E)"
          >
            <Eraser className="h-5 w-5" />
            <span className="absolute left-14 hidden group-hover:block rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-700 border border-zinc-200 whitespace-nowrap shadow-md dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              Eraser (E)
            </span>
          </button>

          {/* Color Picker */}
          <button
            onClick={() => setActiveTool("picker")}
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all relative group cursor-pointer ${
              activeTool === "picker"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-500/40"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
            title="Eye Dropper (I)"
          >
            <Pipette className="h-5 w-5" />
            <span className="absolute left-14 hidden group-hover:block rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-700 border border-zinc-200 whitespace-nowrap shadow-md dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              Pipette (I)
            </span>
          </button>

          {/* Pan Tool */}
          <button
            onClick={() => setActiveTool("hand")}
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all relative group cursor-pointer ${
              activeTool === "hand"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-500/40"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
            title="Hand Tool / Pan (H)"
          >
            <Hand className="h-5 w-5" />
            <span className="absolute left-14 hidden group-hover:block rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-700 border border-zinc-200 whitespace-nowrap shadow-md dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              Pan (H)
            </span>
          </button>

          <div className="hidden h-px bg-zinc-200 my-1 md:block dark:bg-zinc-800" />
          <div className="h-4 w-px bg-zinc-200 md:hidden dark:bg-zinc-800" />

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid((prev) => !prev)}
            className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all relative group cursor-pointer ${
              showGrid
                ? "bg-zinc-200 text-indigo-600 border border-zinc-300 dark:bg-zinc-800 dark:text-indigo-400 dark:border-zinc-700"
                : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            }`}
            title="Toggle Grid Overlay (G)"
          >
            <Grid className="h-5 w-5" />
            <span className="absolute left-14 hidden group-hover:block rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-700 border border-zinc-200 whitespace-nowrap shadow-md dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              Grid lines (G)
            </span>
          </button>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-200 bg-white/90 p-1.5 shadow-2xl backdrop-blur-md sm:bottom-6 dark:border-zinc-800 dark:bg-zinc-900/80">
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.15, 2))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-all cursor-pointer dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <div className="px-3 text-xs font-semibold text-zinc-700 min-w-14 text-center sm:min-w-16 dark:text-zinc-300">
            {Math.round(zoom * 10)}%
          </div>

          <button
            onClick={() => setZoom((z) => Math.min(z * 1.15, 35))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-all cursor-pointer dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-zinc-200 mx-0.5 dark:bg-zinc-800" />

          <button
            onClick={() => {
              setZoom(10);
              setPan({ x: 0, y: 0 });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-all cursor-pointer dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            title="Reset Zoom & Position (R)"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>

        {/* Viewport for Canvas drawing and dragging */}
        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 overflow-hidden flex items-center justify-center relative touch-none outline-none ${cursorStyle}`}
        >
          {/* Canvas Wrapper holding both the canvas and the grid overlay */}
          <div
            className="relative shadow-2xl border-4 border-zinc-300 bg-zinc-200 overflow-hidden dark:border-zinc-950 dark:bg-zinc-900"
            style={{
              width: 50 * zoom,
              height: 50 * zoom,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              transition: isPanning ? "none" : "transform 0.05s ease-out",
            }}
          >
            {/* The primary 50x50 canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{
                width: "100%",
                height: "100%",
                imageRendering: "pixelated",
              }}
            />

            {/* Grid overlay lining up pixel boundaries */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, ${gridLineColor} 1px, transparent 1px),
                                    linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)`,
                  backgroundSize: `${zoom}px ${zoom}px`,
                }}
              />
            )}
          </div>

          {/* Floating Coords/Hover indicators */}
          {hoveredCoord && (
            <div className="absolute top-3 left-3 max-sm:right-3 max-sm:left-auto rounded-lg border border-zinc-200 bg-white/90 px-2.5 py-1 text-[10px] text-zinc-700 font-mono shadow-md backdrop-blur flex items-center gap-2 sm:top-6 sm:left-6 sm:px-3 sm:py-1.5 sm:text-xs dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-300">
              <MousePointer className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
              <span>
                X:{" "}
                <strong className="text-zinc-900 dark:text-white">
                  {hoveredCoord.x}
                </strong>
                , Y:{" "}
                <strong className="text-zinc-900 dark:text-white">
                  {hoveredCoord.y}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Palette & stats sidebar — drawer on mobile, panel on desktop */}
        <aside
          className={`fixed inset-y-0 right-0 z-40 flex w-[min(100vw,20rem)] flex-col border-l border-zinc-200 bg-white/95 backdrop-blur-md transition-[transform,width] duration-300 lg:relative lg:z-10 lg:bg-zinc-50/95 dark:border-zinc-800 dark:bg-zinc-900/95 dark:lg:bg-zinc-900/60 ${
            isSidebarOpen
              ? "translate-x-0 lg:w-80"
              : "pointer-events-none translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:border-l-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="absolute -left-3.5 top-1/2 hidden -translate-y-1/2 lg:flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all cursor-pointer shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Collapse sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 lg:hidden dark:border-zinc-800"
            aria-label="Close sidebar"
          >
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Palette & stats
            </span>
            <ChevronRight className="h-5 w-5 text-zinc-500" />
          </button>

          <div className="flex min-h-0 flex-1 flex-col space-y-6 overflow-y-auto p-4 sm:p-5">
            {/* Color Palette Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider dark:text-zinc-400">
                  Color Palette
                </span>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                  <span
                    className="h-3 w-3 rounded-full border border-zinc-800"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <span className="font-mono text-[10px]">
                    {selectedColor.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      if (activeTool === "eraser" || activeTool === "picker") {
                        setActiveTool("pen");
                      }
                    }}
                    className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-2 transition-all relative flex items-center justify-center cursor-pointer shadow-sm ${
                      selectedColor === color
                        ? "border-zinc-900 scale-110 shadow-indigo-500/10 shadow-md dark:border-white"
                        : "border-transparent hover:scale-105 hover:border-zinc-400 dark:hover:border-zinc-500"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {selectedColor === color && (
                      <Check
                        className={`h-4.5 w-4.5 ${
                          color === "#ffffff" ||
                          color === "#f59e0b" ||
                          color === "#eab308"
                            ? "text-black"
                            : "text-white"
                        }`}
                      />
                    )}
                  </button>
                ))}

                {/* Custom Color Input Wrapper */}
                <label
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-2 border-dashed border-zinc-300 hover:border-zinc-500 flex items-center justify-center cursor-pointer transition-all hover:scale-105 bg-zinc-100 relative dark:border-zinc-700 dark:bg-zinc-800/40"
                  title="Choose custom color"
                >
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => {
                      setSelectedColor(e.target.value);
                      if (activeTool === "eraser" || activeTool === "picker") {
                        setActiveTool("pen");
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-[18px] font-bold text-zinc-400 leading-none">
                    +
                  </span>
                </label>
              </div>
            </div>

            <div className="h-px bg-zinc-200 dark:bg-zinc-800/80" />

            {/* Canvas Statistics Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider dark:text-zinc-400">
                  Canvas Insights
                </span>
              </div>

              {/* Progress Bar of Painted pixels */}
              <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800/50 dark:bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                  <span>Painted coverage</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-white">
                    {stats.totalPainted} / 2500 px ({stats.percent}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
              </div>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex min-h-16 flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800/50 dark:bg-zinc-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Active Color
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full border border-zinc-300 dark:border-zinc-700"
                      style={{ backgroundColor: selectedColor }}
                    />
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {selectedColor}
                    </span>
                  </div>
                </div>

                <div className="flex min-h-16 flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800/50 dark:bg-zinc-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Popular Color
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full border border-zinc-300 dark:border-zinc-700"
                      style={{ backgroundColor: stats.popularColor }}
                    />
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {stats.popularColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Color breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Top Colors Used
                </span>
                <div className="space-y-1.5">
                  {stats.colorCounts.map(({ color, count, pct }) => (
                    <div
                      key={color}
                      className="flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-zinc-700"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {color}
                        </span>
                      </div>
                      <span className="text-zinc-500 dark:text-zinc-500">
                        {count} px ({pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-zinc-200 dark:bg-zinc-800/80" />

            {/* Drawing Action History Log */}
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider dark:text-zinc-400">
                  Your paint logs
                </span>
              </div>

              <div className="scrollbar-thin min-h-36 max-h-48 flex-1 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono sm:max-h-56 dark:border-zinc-800/50 dark:bg-zinc-950/40">
                {paintHistory.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs italic text-zinc-500 dark:text-zinc-600">
                    Paint pixels to see history
                  </div>
                ) : (
                  paintHistory.map((log, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-zinc-200 pb-1 text-[11px] last:border-b-0 dark:border-zinc-900/60"
                    >
                      <span className="text-zinc-500">{log.time}</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        ({log.x}, {log.y})
                      </span>
                      <span
                        className="font-semibold px-1 rounded text-[10px]"
                        style={{ color: log.color }}
                      >
                        {log.color}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Shortcuts Guide Footer */}
            <div className="space-y-1 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[10px] text-zinc-600 dark:border-zinc-800/40 dark:bg-zinc-900/40 dark:text-zinc-500">
              <div className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                <Info className="h-3 w-3 text-indigo-400" />
                <span>Quick Hotkeys</span>
              </div>
              <div className="flex justify-between">
                <span>Pen / Brush</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  B
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Eraser</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  E
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Pipette</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  I
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Hand / Pan</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  H
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Hold Space</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Pan Drag
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Toggle Grid</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  G
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Reset Zoom</span>
                <kbd className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  R
                </kbd>
              </div>
            </div>
          </div>
        </aside>

        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 text-zinc-600 shadow-2xl backdrop-blur transition-all hover:bg-zinc-100 hover:text-zinc-900 lg:flex dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Open sidebar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Confirmation Modal overlay for Clear Canvas */}
      {isConfirmingClear && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-2xl backdrop-blur-md animate-scale-up dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="flex items-center gap-3 text-red-500 dark:text-red-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/50">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Reset Canvas?
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              This action will reset all 2,500 pixels back to the default black
              canvas. All custom designs will be cleared. This cannot be undone.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="cursor-pointer rounded-lg bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-800 transition-all hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCanvas}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer shadow-lg shadow-red-600/20"
              >
                Reset Grid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
