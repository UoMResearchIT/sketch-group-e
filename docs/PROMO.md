# Promotional copy — social, resume & portfolio

| Link           | URL                                          |
| -------------- | -------------------------------------------- |
| **Repository** | https://github.com/odilson-dev/rplace-convex |
| **Live demo**  | https://rplace-convex-lime.vercel.app/       |

---

## LinkedIn post

**Option A — story-led (recommended)**

I built a live collaborative pixel canvas inspired by Reddit’s r/place — but the interesting part isn’t the grid, it’s the backend.

**r/place × Convex** is a 50×50 canvas where anyone can paint at the same time. Every stroke syncs instantly to every open browser. No custom WebSocket server, no REST polling, no hand-rolled DB sync.

**Stack:** Next.js 16 · React 19 · Convex · TypeScript · Tailwind CSS

**What Convex handles here:**
→ Shared canvas state in the database  
→ Real-time updates via reactive queries (`useQuery`)  
→ Batched mutations with optimistic UI on the client  
→ Pixel placement history for auditing

If you’ve wondered what Convex is _for_, this project is a concrete answer: real-time multiplayer state with very little glue code.

Try it live: https://rplace-convex-lime.vercel.app/  
Code on GitHub: https://github.com/odilson-dev/rplace-convex

Open to feedback and contributions. What would you add next — auth, cooldowns, or a bigger canvas?

#webdev #react #nextjs #typescript #convex #realtime #opensource #sideproject #fullstack

---

**Option B — shorter**

Shipped **r/place × Convex** — a real-time collaborative pixel canvas.

Paint on a shared 50×50 grid with live sync powered by Convex (queries + mutations, no custom WebSocket layer). Built with Next.js, React 19, and TypeScript.

Live: https://rplace-convex-lime.vercel.app/  
Repo: https://github.com/odilson-dev/rplace-convex

#webdev #convex #nextjs #react

---

## Twitter / X

**Single tweet (~240 chars — fits with one link; add the second in a reply or use a link hub)**

Built r/place × Convex — a live collaborative pixel canvas.

50×50 grid, instant sync via @convex dev, optimistic UI, Next.js + React 19.

https://rplace-convex-lime.vercel.app/

**Reply tweet (repo)**

Source & docs: https://github.com/odilson-dev/rplace-convex

---

**Thread (optional)**

**1/** I wanted a small project that shows _why_ Convex exists — not slides, a real app.

r/place × Convex: multiplayer pixel canvas, open source.

**2/** Multiple browsers paint the same 50×50 grid. Changes show up live for everyone. Backend = Convex queries + mutations. Frontend = `useQuery` + batched `paintPixels`.

**3/** No Socket.io, no sync service, no “refresh to see updates.” Convex is the database + API + realtime layer in one.

**4/** Also: optimistic painting, pixel history table, export PNG, dark mode, zoom/pan tools.

**5/** Try it → https://rplace-convex-lime.vercel.app/  
Star / fork → https://github.com/odilson-dev/rplace-convex

---

**Hashtags (pick 2–4 max on X)**

`#buildinpublic` `#webdev` `#convex` `#nextjs`

---

## Resume

### Project line (one line under Projects)

**r/place × Convex** — Real-time collaborative pixel canvas; Convex-backed live sync, optimistic UI, batched mutations · Next.js, React, TypeScript

### Bullet points (pick 2–4)

- Built a **real-time multiplayer web app** where multiple users paint a shared 50×50 canvas with **sub-second sync** across clients using **Convex** reactive queries and mutations (no custom WebSocket infrastructure).
- Designed **Convex schema** (`canvas`, `pixelHistory`) with indexed lookups and server-side validation for pixel updates and placement audit trail.
- Implemented **optimistic UI** with debounced/batched writes to reduce mutation load while keeping the canvas responsive during drag-painting.
- Delivered a **Next.js 16 / React 19** front end with canvas rendering, zoom/pan, tool palette, PNG export, and light/dark theme.

### Skills to tag (ATS-friendly)

`TypeScript` · `React` · `Next.js` · `Convex` · `Real-time systems` · `REST alternative / BaaS` · `Tailwind CSS`

---

## Portfolio

### Project title

**r/place × Convex** — Live collaborative pixel canvas

### One-liner (card subtitle)

Multiplayer r/place-style canvas with instant sync powered by Convex and a Next.js UI.

### Description (2–3 sentences)

A browser-based pixel art canvas where anyone can paint on the same grid at once. The backend is entirely Convex: shared state lives in the database, and every client subscribes with reactive queries so strokes appear live without polling or a custom realtime server. The front end uses optimistic updates and batched mutations for a smooth drawing experience.

### Highlights (bullet list for project page)

- **Real-time collaboration** — `useQuery(api.canvas.getCanvas)` keeps all clients in sync
- **Convex backend** — schema, mutations (`paintPixels`, `clearCanvas`), pixel history
- **Rich canvas UX** — pen, eraser, eyedropper, pan, zoom, grid toggle, PNG export
- **Modern stack** — Next.js 16, React 19, TypeScript, Tailwind CSS v4

### Tech stack (chips)

Next.js · React · Convex · TypeScript · Tailwind CSS

### Call-to-action buttons

| Label       | URL                                          |
| ----------- | -------------------------------------------- |
| View live   | `https://rplace-convex-lime.vercel.app/`     |
| View source | https://github.com/odilson-dev/rplace-convex |

### Meta (SEO / Open Graph — if your portfolio supports per-project fields)

- **Title:** r/place × Convex — Real-time collaborative canvas
- **Description:** Paint on a shared pixel grid with live updates. Built with Next.js and Convex.
- **Image:** Use `docs/project-hero.png` from the repo (or upload the same asset to your portfolio CDN)

---

## Image assets

| File                                        | Use                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------- |
| [`docs/project-hero.png`](project-hero.png) | README header, LinkedIn article cover, portfolio thumbnail, OG image |

**Tip:** On LinkedIn, upload the hero image as the post image (not only a link preview) for better reach.
