import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { fileURLToPath, URL } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error — plain .mjs plugin, same pre-existing moduleResolution limitation as the vite imports above
import { aiEndpointsPlugin } from "./vite-plugins/ai-endpoints.mjs";
// @ts-expect-error — plain .mjs plugin
import { youtubeEndpointsPlugin } from "./vite-plugins/youtube-endpoints.mjs";

interface RenderJob {
  id: string;
  status: "rendering" | "done" | "error";
  progress: number;
  output: string;
  error: string;
  log: string;
}

// Dev-only render endpoint: shells out to the installed Remotion CLI (`remotion render`)
// with the settings from the Render dialog, tracks progress, and serves the result.
// Rendering is Node-side (headless Chromium) — it cannot run in the browser. A shipped
// product would move this behind a real backend / Remotion Lambda.
function renderApiPlugin(): PluginOption {
  const jobs = new Map<string, RenderJob>();

  const readBody = (req: import("node:http").IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        try {
          resolve(JSON.parse(data || "{}"));
        } catch {
          resolve({});
        }
      });
    });

  const start = (job: RenderJob, body: Record<string, unknown>) => {
    const compId = String(body.compId || "MyComp");
    const codec = String(body.codec || "h264");
    // Sanitize the filename so every CLI arg is space-free (no quoting needed).
    const filename = String(body.filename || `${compId}.mp4`).replace(/[^a-zA-Z0-9._-]/g, "_");
    fs.mkdirSync("out", { recursive: true });
    const out = `out/${filename}`;

    const flags = [`--codec=${codec}`];
    if (body.crf != null && codec !== "gif") flags.push(`--crf=${body.crf}`);
    if (body.scale && Number(body.scale) !== 1) flags.push(`--scale=${body.scale}`);
    if (body.frames) flags.push(`--frames=${body.frames}`);
    if (body.props) {
      // Pass props via a file to avoid shell-quoting the inline JSON.
      const pf = "out/.vibe-props.json";
      fs.writeFileSync(path.join(process.cwd(), pf), JSON.stringify(body.props));
      flags.push(`--props=${pf}`);
    }

    // shell:true is REQUIRED on Windows — Node 22 refuses to spawn npx.cmd directly.
    // It also lets us pass one command string; all args are space-free.
    const cmd = `npx remotion render src/index.ts ${compId} ${out} ${flags.join(" ")}`;
    job.log = `$ ${cmd}\n`;
    const child = spawn(cmd, { cwd: process.cwd(), shell: true });

    const onData = (d: Buffer) => {
      const s = d.toString();
      job.log = (job.log + s).slice(-4000);
      const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
      if (frac) job.progress = Math.min(99, Math.round((+frac[1] / +frac[2]) * 100));
      const pct = s.match(/(\d{1,3})\s*%/);
      if (pct) job.progress = Math.min(99, +pct[1]);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (e) => {
      job.status = "error";
      job.error = String(e);
    });
    child.on("close", (code) => {
      if (code === 0) {
        job.status = "done";
        job.progress = 100;
        job.output = `/rendered/${encodeURIComponent(path.basename(out))}`;
      } else if (job.status !== "error") {
        job.status = "error";
        job.error = job.log.split("\n").filter(Boolean).slice(-6).join("\n") || `exit ${code}`;
      }
    });
  };

  return {
    name: "vibe-render-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        if (url === "/api/render" && req.method === "POST") {
          readBody(req).then((body) => {
            const id = `${Date.now()}`;
            const job: RenderJob = { id, status: "rendering", progress: 0, output: "", error: "", log: "" };
            jobs.set(id, job);
            try {
              start(job, body);
            } catch (e) {
              job.status = "error";
              job.error = String(e);
            }
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ id }));
          });
          return;
        }

        if (url.startsWith("/api/render?") && req.method === "GET") {
          const id = new URLSearchParams(url.split("?")[1]).get("id") || "";
          const job = jobs.get(id);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(job || { status: "error", error: "job not found", progress: 0 }));
          return;
        }

        if (url.startsWith("/rendered/")) {
          const name = decodeURIComponent(url.slice("/rendered/".length).split("?")[0]);
          const fp = path.join(process.cwd(), "out", name);
          if (fs.existsSync(fp)) {
            const ext = path.extname(fp).toLowerCase();
            const types: Record<string, string> = {
              ".mp4": "video/mp4",
              ".webm": "video/webm",
              ".gif": "image/gif",
              ".mov": "video/quicktime",
            };
            res.setHeader("content-type", types[ext] || "application/octet-stream");
            res.setHeader("content-disposition", `attachment; filename="${name}"`);
            fs.createReadStream(fp).pipe(res);
            return;
          }
        }

        next();
      });
    },
  };
}

// The "vibe" editor — a custom web UI that embeds the Remotion compositions via
// @remotion/player, plus a dev render endpoint. Tailwind v4 is wired through its
// PostCSS plugin scoped here (not a global postcss.config), so it can't interfere
// with Remotion's own Tailwind setup.
export default defineConfig({
  plugins: [react(), renderApiPlugin(), aiEndpointsPlugin(), youtubeEndpointsPlugin()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    open: true,
  },
});
