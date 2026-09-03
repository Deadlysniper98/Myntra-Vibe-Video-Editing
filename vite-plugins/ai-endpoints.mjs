// Dev-only AI asset endpoints for the Vibe editor.
//
// Same middleware style as renderApiPlugin in vite.config.ts: one connect-style
// middleware on the Vite dev server that switches on req.url + req.method and
// calls next() for anything unmatched. Plain ESM JavaScript on purpose — tsc
// does not type-check .mjs files (module resolution of Vite v8 types is a known
// pre-existing issue), and Node 18+ provides a global fetch.
//
// Endpoints:
//   POST /api/gemini        — proxy to Gemini generateContent (x-goog-api-key)
//   POST /api/omni-video    — proxy to Gemini Omni Flash Interactions API (x-goog-api-key)
//   POST /api/tts           — proxy to ElevenLabs text-to-speech (xi-api-key), returns audio/mpeg
//   GET  /api/voices        — proxy to ElevenLabs GET /v1/voices
//   POST /api/assets/save   — write a base64 payload into public/<subdir>/
//   GET  /api/assets/list   — list files in public/<subdir>/
//   POST /api/still         — shell `npx remotion still` into public/qa/
//
// Keys are passed per-request from the browser (they live in localStorage via
// the Settings dialog) and are never persisted server-side.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Subdirectories of public/ that the asset endpoints may touch. */
const ALLOWED_SUBDIRS = ["generated", "voiceover", "qa"];

/**
 * Load KEY=VALUE pairs from .env.local into process.env (only for keys not
 * already set). No `dotenv` dependency — this file is the only consumer.
 */
function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

/**
 * GET /api/config — reports which provider keys are pre-configured in
 * .env.local so the editor can self-fill Settings instead of asking the user
 * to paste keys in every time. Dev-only endpoint, localhost only.
 */
function handleConfig(res) {
  sendJson(res, 200, {
    google: process.env.GEMINI_API_KEY || "",
    elevenlabs: process.env.ELEVENLABS_API_KEY || "",
    youtubeClientId: process.env.YOUTUBE_CLIENT_ID || "",
    youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
  });
}

/**
 * Strip anything path-like out of a file name: no separators, no "..", only
 * [a-zA-Z0-9._-], never empty, never a dotfile-only name.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFileName(name) {
  const base = path.basename(String(name || "")).replace(/[^a-zA-Z0-9._-]/g, "_");
  const trimmed = base.replace(/^\.+/, "");
  return trimmed || "file";
}

/**
 * Validate a public/ subdir against the allowlist.
 * @param {string} subdir
 * @returns {string | null} the safe subdir, or null when not allowed
 */
function safeSubdir(subdir) {
  const s = String(subdir || "");
  return ALLOWED_SUBDIRS.includes(s) ? s : null;
}

/**
 * Parse a JSON request body (same approach as renderApiPlugin: never rejects,
 * resolves {} on malformed JSON).
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
function readBody(req) {
  return new Promise((resolve) => {
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
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

/**
 * POST /api/gemini — body { model, body, apiKey }.
 * Proxies to https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * with the x-goog-api-key header (verified against ai.google.dev REST docs:
 * request uses camelCase `contents[].parts[]` + `generationConfig`; responses
 * carry image bytes in `candidates[].content.parts[].inlineData.{mimeType,data}`;
 * errors are `{error:{code,message,status}}`). Upstream status is forwarded so
 * the client can implement the 404/permission model fallback.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleGemini(req, res) {
  const body = await readBody(req);
  const model = String(body.model || "").replace(/[^a-zA-Z0-9._-]/g, "");
  const apiKey = String(body.apiKey || process.env.GEMINI_API_KEY || "");
  if (!model || !apiKey) {
    sendJson(res, 400, { error: { code: 400, message: "model and apiKey are required", status: "INVALID_ARGUMENT" } });
    return;
  }
  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body.body ?? {}),
      },
    );
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("content-type", "application/json");
    // Upstream should always be JSON; guard anyway so the client never gets HTML.
    try {
      JSON.parse(text);
      res.end(text);
    } catch {
      res.end(JSON.stringify({ error: { code: upstream.status, message: text.slice(0, 500), status: "UPSTREAM_NOT_JSON" } }));
    }
  } catch (e) {
    sendJson(res, 502, { error: { code: 502, message: `Gemini proxy failed: ${String(e)}`, status: "PROXY_ERROR" } });
  }
}

/**
 * POST /api/omni-video — body { body, apiKey }.
 * Proxies to https://generativelanguage.googleapis.com/v1beta/interactions
 * (Gemini Omni Flash — verified against ai.google.dev/gemini-api/docs/omni:
 * different endpoint shape from generateContent, same x-goog-api-key header).
 * Video output can be large (inline base64), so this simply forwards the
 * upstream body through — same pass-through approach as handleGemini.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleOmniVideo(req, res) {
  const body = await readBody(req);
  const apiKey = String(body.apiKey || process.env.GEMINI_API_KEY || "");
  if (!apiKey) {
    sendJson(res, 400, { error: { code: 400, message: "apiKey is required", status: "INVALID_ARGUMENT" } });
    return;
  }
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body.body ?? {}),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("content-type", "application/json");
    try {
      JSON.parse(text);
      res.end(text);
    } catch {
      res.end(JSON.stringify({ error: { code: upstream.status, message: text.slice(0, 500), status: "UPSTREAM_NOT_JSON" } }));
    }
  } catch (e) {
    sendJson(res, 502, { error: { code: 502, message: `Omni Flash proxy failed: ${String(e)}`, status: "PROXY_ERROR" } });
  }
}

/**
 * POST /api/tts — body { voiceId, text, modelId?, apiKey }.
 * Proxies to https://api.elevenlabs.io/v1/text-to-speech/{voice_id} (verified
 * shape: xi-api-key header, JSON body { text, model_id }, binary audio back;
 * output_format defaults to mp3_44100_128 so the bytes are MPEG audio).
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleTts(req, res) {
  const body = await readBody(req);
  const voiceId = String(body.voiceId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const text = String(body.text || "");
  const apiKey = String(body.apiKey || process.env.ELEVENLABS_API_KEY || "");
  if (!voiceId || !text || !apiKey) {
    sendJson(res, 400, { error: "voiceId, text and apiKey are required" });
    return;
  }
  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: String(body.modelId || "eleven_multilingual_v2"),
      }),
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      sendJson(res, upstream.status, { error: errText.slice(0, 1000) });
      return;
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("content-type", "audio/mpeg");
    res.end(bytes);
  } catch (e) {
    sendJson(res, 502, { error: `ElevenLabs proxy failed: ${String(e)}` });
  }
}

/**
 * GET /api/voices?apiKey=… — proxies GET https://api.elevenlabs.io/v1/voices
 * (response: { voices: [{ voice_id, name, labels, … }] }).
 * @param {string} url
 * @param {import("node:http").ServerResponse} res
 */
async function handleVoices(url, res) {
  const apiKey =
    new URLSearchParams(url.split("?")[1] || "").get("apiKey") || process.env.ELEVENLABS_API_KEY || "";
  if (!apiKey) {
    sendJson(res, 400, { error: "apiKey query param is required" });
    return;
  }
  try {
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("content-type", "application/json");
    res.end(text);
  } catch (e) {
    sendJson(res, 502, { error: `ElevenLabs proxy failed: ${String(e)}` });
  }
}

/**
 * POST /api/voices/clone — body { name, audioBase64, mimeType?, apiKey }.
 * Proxies to https://api.elevenlabs.io/v1/voices/add (Instant Voice Cloning:
 * multipart/form-data with `name` + `files[]`, verified against ElevenLabs'
 * own docs 2026 — response is { voice_id }). The client sends base64 JSON
 * (same pattern as handleAssetSave) so no multipart parser is needed here;
 * this handler reconstructs the multipart body itself using Node's global
 * FormData/Blob (Node 18+) before forwarding upstream.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleVoiceClone(req, res) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  const audioBase64 = String(body.audioBase64 || "");
  const mimeType = String(body.mimeType || "audio/mpeg");
  const apiKey = String(body.apiKey || process.env.ELEVENLABS_API_KEY || "");
  if (!name || !audioBase64 || !apiKey) {
    sendJson(res, 400, { error: "name, audioBase64 and apiKey are required" });
    return;
  }
  try {
    const bytes = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("name", name);
    form.append("files", new Blob([bytes], { type: mimeType }), "sample.mp3");
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("content-type", "application/json");
    res.end(text);
  } catch (e) {
    sendJson(res, 502, { error: `ElevenLabs voice clone proxy failed: ${String(e)}` });
  }
}

/**
 * POST /api/assets/save — body { subdir, fileName, dataBase64 }.
 * Writes to public/<subdir>/<fileName>; returned path is staticFile-relative.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleAssetSave(req, res) {
  const body = await readBody(req);
  const subdir = safeSubdir(body.subdir);
  const fileName = sanitizeFileName(String(body.fileName || ""));
  const dataBase64 = String(body.dataBase64 || "");
  if (!subdir) {
    sendJson(res, 400, { error: `subdir must be one of: ${ALLOWED_SUBDIRS.join(", ")}` });
    return;
  }
  if (!dataBase64) {
    sendJson(res, 400, { error: "dataBase64 is required" });
    return;
  }
  try {
    const dir = path.join(process.cwd(), "public", subdir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), Buffer.from(dataBase64, "base64"));
    sendJson(res, 200, { ok: true, path: `${subdir}/${fileName}` });
  } catch (e) {
    sendJson(res, 500, { error: `save failed: ${String(e)}` });
  }
}

/**
 * GET /api/assets/list?subdir=… — { files: [{ name, size }] }.
 * @param {string} url
 * @param {import("node:http").ServerResponse} res
 */
function handleAssetList(url, res) {
  const subdir = safeSubdir(new URLSearchParams(url.split("?")[1] || "").get("subdir"));
  if (!subdir) {
    sendJson(res, 400, { error: `subdir must be one of: ${ALLOWED_SUBDIRS.join(", ")}` });
    return;
  }
  const dir = path.join(process.cwd(), "public", subdir);
  /** @type {{name: string, size: number}[]} */
  let files = [];
  try {
    files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && !d.name.startsWith("."))
      .map((d) => ({ name: d.name, size: fs.statSync(path.join(dir, d.name)).size }));
  } catch {
    // Directory doesn't exist yet — an empty library, not an error.
  }
  sendJson(res, 200, { files });
}

/**
 * POST /api/still — body { compositionId, frame, outName, propsJson? }.
 * Shells the Remotion CLI (same spawn approach as renderApiPlugin —
 * shell:true is REQUIRED on Windows, all args kept space-free, props passed
 * via a temp file) and writes the still into public/qa/.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleStill(req, res) {
  const body = await readBody(req);
  const compositionId = String(body.compositionId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const frame = Number.isFinite(Number(body.frame)) ? Math.max(0, Math.floor(Number(body.frame))) : 0;
  const outName = sanitizeFileName(String(body.outName || `${compositionId}-${frame}.png`));
  if (!compositionId) {
    sendJson(res, 400, { error: "compositionId is required" });
    return;
  }
  try {
    const qaDir = path.join(process.cwd(), "public", "qa");
    fs.mkdirSync(qaDir, { recursive: true });

    const flags = [`--frame=${frame}`];
    if (body.propsJson && typeof body.propsJson === "object") {
      // Pass props via a file to avoid shell-quoting the inline JSON.
      const pf = "public/qa/.vibe-still-props.json";
      fs.writeFileSync(path.join(process.cwd(), pf), JSON.stringify(body.propsJson));
      flags.push(`--props=${pf}`);
    }

    const outRel = `public/qa/${outName}`;
    const cmd = `npx remotion still src/index.ts ${compositionId} ${outRel} ${flags.join(" ")}`;
    // shell:true is REQUIRED on Windows — Node 22 refuses to spawn npx.cmd directly.
    const child = spawn(cmd, { cwd: process.cwd(), shell: true });

    let log = `$ ${cmd}\n`;
    const onData = (d) => {
      log = (log + d.toString()).slice(-4000);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (e) => {
      sendJson(res, 500, { error: String(e) });
    });
    child.on("close", (code) => {
      if (res.writableEnded) return;
      if (code === 0) {
        sendJson(res, 200, { ok: true, path: `qa/${outName}` });
      } else {
        const tail = log.split("\n").filter(Boolean).slice(-6).join("\n");
        sendJson(res, 500, { error: tail || `remotion still exited with code ${code}` });
      }
    });
  } catch (e) {
    sendJson(res, 500, { error: `still failed: ${String(e)}` });
  }
}

/**
 * Vite plugin registering all AI dev endpoints.
 * @returns {import("vite").PluginOption}
 */
export function aiEndpointsPlugin() {
  return {
    name: "vibe-ai-endpoints",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        if (url === "/api/config" && req.method === "GET") {
          handleConfig(res);
          return;
        }
        if (url === "/api/gemini" && req.method === "POST") {
          handleGemini(req, res);
          return;
        }
        if (url === "/api/omni-video" && req.method === "POST") {
          handleOmniVideo(req, res);
          return;
        }
        if (url === "/api/tts" && req.method === "POST") {
          handleTts(req, res);
          return;
        }
        if ((url === "/api/voices" || url.startsWith("/api/voices?")) && req.method === "GET") {
          handleVoices(url, res);
          return;
        }
        if (url === "/api/voices/clone" && req.method === "POST") {
          handleVoiceClone(req, res);
          return;
        }
        if (url === "/api/assets/save" && req.method === "POST") {
          handleAssetSave(req, res);
          return;
        }
        if (url.startsWith("/api/assets/list") && req.method === "GET") {
          handleAssetList(url, res);
          return;
        }
        if (url === "/api/still" && req.method === "POST") {
          handleStill(req, res);
          return;
        }

        next();
      });
    },
  };
}
