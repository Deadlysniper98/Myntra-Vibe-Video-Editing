// Dev-only YouTube OAuth + upload for the Vibe editor.
// OAuth client credentials + refresh token are passed per-request from the browser
// (localStorage). Tokens are never persisted server-side.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";

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

function envYouTubeCreds() {
  return {
    clientId: (process.env.YOUTUBE_CLIENT_ID || "").trim(),
    clientSecret: (process.env.YOUTUBE_CLIENT_SECRET || "").trim(),
  };
}

function resolveYouTubeCreds(body) {
  const fromBody = {
    clientId: String(body?.clientId || "").trim(),
    clientSecret: String(body?.clientSecret || "").trim(),
  };
  if (fromBody.clientId && fromBody.clientSecret) return fromBody;
  const fromEnv = envYouTubeCreds();
  return {
    clientId: fromBody.clientId || fromEnv.clientId,
    clientSecret: fromBody.clientSecret || fromEnv.clientSecret,
  };
}

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube",
].join(" ");

/** @type {Map<string, { clientId: string; clientSecret: string; createdAt: number }>} */
const oauthStates = new Map();

/** @type {Map<string, { ok: boolean; createdAt: number; [key: string]: unknown }>} */
const oauthResults = new Map();

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

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function redirectUri(req) {
  const host = req.headers.host || "localhost:5173";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}/api/youtube/oauth/callback`;
}

function pruneStates() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of oauthStates) {
    if (v.createdAt < cutoff) oauthStates.delete(k);
  }
  for (const [k, v] of oauthResults) {
    if (v.createdAt < cutoff) oauthResults.delete(k);
  }
}

function storeOAuthResult(state, payload) {
  if (!state) return;
  oauthResults.set(state, { ...payload, createdAt: Date.now() });
}

async function exchangeCode(code, clientId, clientSecret, redirect) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `token exchange failed (${res.status})`);
  }
  return json;
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `refresh failed (${res.status})`);
  }
  return json.access_token;
}

async function fetchChannelDetails(accessToken) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `channels.list failed (${res.status})`);
  const item = json.items?.[0];
  if (!item) throw new Error("No YouTube channel found for this account");
  const thumbs = item.snippet?.thumbnails;
  return {
    channelId: item.id,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    customUrl: item.snippet?.customUrl,
    thumbnailUrl:
      thumbs?.medium?.url || thumbs?.default?.url || thumbs?.high?.url || undefined,
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

async function fetchChannelInfo(accessToken) {
  try {
    const d = await fetchChannelDetails(accessToken);
    return {
      channelTitle: d.title,
      youtubeChannelId: d.channelId,
      thumbnailUrl: d.thumbnailUrl,
    };
  } catch {
    return { channelTitle: undefined, youtubeChannelId: undefined, thumbnailUrl: undefined };
  }
}

function oauthResultHtml(payload, ok, state) {
  const data = JSON.stringify({ type: "vibe-youtube-oauth", ok, state, ...payload });
  const msg = ok
    ? "YouTube connected! You can close this window."
    : `Connection failed: ${payload.error || "unknown error"}`;
  return `<!DOCTYPE html><html><head><title>YouTube · Vibe</title></head><body style="font-family:system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh;margin:0;padding:24px;text-align:center">
<p style="max-width:320px;line-height:1.5">${msg}</p>
<p style="font-size:13px;color:#888;margin-top:16px">Return to the Vibe editor — it should show as connected.</p>
<button onclick="window.close()" style="margin-top:20px;padding:10px 20px;border-radius:8px;border:none;background:#ff4444;color:#fff;font-weight:600;cursor:pointer">Close window</button>
<script>
(function(){
  var payload=${data};
  try{if(window.opener&&!window.opener.closed){window.opener.postMessage(payload,window.location.origin);window.close();return;}}catch(e){}
  try{var bc=new BroadcastChannel("vibe-youtube-oauth");bc.postMessage(payload);bc.close();}catch(e){}
  setTimeout(function(){
    var s=payload.state||"";
    if(s){window.location.href=window.location.origin+"/?youtube_oauth_state="+encodeURIComponent(s);}
    else{try{window.close();}catch(e){}}
  },900);
})();
</script>
</body></html>`;
}

async function handleOAuthStart(req, res) {
  const body = await readBody(req);
  const { clientId, clientSecret } = resolveYouTubeCreds(body);
  if (!clientId || !clientSecret) {
    sendJson(res, 400, { error: "clientId and clientSecret are required (set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET in .env.local)" });
    return;
  }
  pruneStates();
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { clientId, clientSecret, createdAt: Date.now() });
  const redirect = redirectUri(req);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: YOUTUBE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  sendJson(res, 200, {
    state,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    redirectUri: redirect,
  });
}

async function handleOAuthCallback(req, res, url) {
  const q = new URLSearchParams(url.split("?")[1] || "");
  const code = q.get("code");
  const state = q.get("state");
  const err = q.get("error");
  if (err) {
    storeOAuthResult(state || "", { ok: false, error: err });
    res.statusCode = 200;
    res.setHeader("content-type", "text/html");
    res.end(oauthResultHtml({ error: err }, false, state || ""));
    return;
  }
  const pending = state ? oauthStates.get(state) : null;
  oauthStates.delete(state || "");
  if (!code || !pending) {
    storeOAuthResult(state || "", { ok: false, error: "Invalid or expired OAuth state" });
    res.statusCode = 200;
    res.setHeader("content-type", "text/html");
    res.end(oauthResultHtml({ error: "Invalid or expired OAuth state" }, false, state || ""));
    return;
  }
  try {
    const redirect = redirectUri(req);
    const tokens = await exchangeCode(code, pending.clientId, pending.clientSecret, redirect);
    if (!tokens.refresh_token) {
      throw new Error("No refresh token — revoke app access in Google Account and try Connect again.");
    }
    const channelInfo = await fetchChannelInfo(tokens.access_token);
    const result = {
      ok: true,
      refreshToken: tokens.refresh_token,
      channelTitle: channelInfo.channelTitle,
      youtubeChannelId: channelInfo.youtubeChannelId,
      thumbnailUrl: channelInfo.thumbnailUrl,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
    };
    storeOAuthResult(state, result);
    res.statusCode = 200;
    res.setHeader("content-type", "text/html");
    res.end(oauthResultHtml(result, true, state));
  } catch (e) {
    const errMsg = String(e.message || e);
    storeOAuthResult(state, { ok: false, error: errMsg });
    res.statusCode = 200;
    res.setHeader("content-type", "text/html");
    res.end(oauthResultHtml({ error: errMsg }, false, state));
  }
}

function handleOAuthPoll(url, res) {
  const state = new URLSearchParams(url.split("?")[1] || "").get("state") || "";
  const result = oauthResults.get(state);
  if (!result) {
    sendJson(res, 200, { pending: true });
    return;
  }
  oauthResults.delete(state);
  sendJson(res, 200, { pending: false, ...result });
}

async function setVideoThumbnail(accessToken, videoId, imageBuf, mime) {
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mime,
        "Content-Length": String(imageBuf.length),
      },
      body: imageBuf,
    },
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Thumbnail upload failed: ${errText.slice(0, 300)}`);
  }
  return res.json();
}

function handleListRenders(res) {
  const outDir = path.join(process.cwd(), "out");
  if (!fs.existsSync(outDir)) {
    sendJson(res, 200, { files: [] });
    return;
  }
  const files = fs
    .readdirSync(outDir)
    .filter((name) => /\.(mp4|webm|mov)$/i.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(outDir, name));
      return {
        filename: name,
        sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  sendJson(res, 200, { files });
}

function revealFileInExplorer(filePath) {
  const quoted = `"${filePath.replace(/"/g, '\\"')}"`;
  if (process.platform === "win32") {
    exec(`explorer /select,${quoted.replace(/\//g, "\\")}`);
  } else if (process.platform === "darwin") {
    exec(`open -R ${quoted}`);
  } else {
    exec(`xdg-open "${path.dirname(filePath)}"`);
  }
}

async function handleRevealRender(req, res) {
  const body = await readBody(req);
  const filename = path.basename(String(body.filename || "").replace(/[^a-zA-Z0-9._-]/g, "_"));
  if (!filename) {
    sendJson(res, 400, { error: "filename is required" });
    return;
  }
  const filePath = path.join(process.cwd(), "out", filename);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: `Rendered file not found: out/${filename}` });
    return;
  }
  try {
    revealFileInExplorer(filePath);
    sendJson(res, 200, { ok: true, path: filePath });
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}

async function handleUpload(req, res) {
  const body = await readBody(req);
  const { clientId, clientSecret } = resolveYouTubeCreds(body);
  const refreshToken = String(body.refreshToken || "").trim();
  const filename = path.basename(String(body.filename || "").replace(/[^a-zA-Z0-9._-]/g, "_"));
  const title = String(body.title || "Untitled").slice(0, 100);
  const description = String(body.description || "").slice(0, 5000);
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).slice(0, 30)).slice(0, 15)
    : String(body.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 15);
  const privacyStatus = ["public", "unlisted", "private"].includes(body.privacyStatus)
    ? body.privacyStatus
    : "unlisted";
  const thumbnailPngBase64 = String(body.thumbnailPngBase64 || "").trim();

  if (!clientId || !clientSecret || !refreshToken || !filename) {
    sendJson(res, 400, { error: "clientId, clientSecret, refreshToken, and filename are required" });
    return;
  }

  const filePath = path.join(process.cwd(), "out", filename);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: `Rendered file not found: out/${filename}` });
    return;
  }

  try {
    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const stat = fs.statSync(filePath);
    const mime = filename.endsWith(".webm") ? "video/webm" : "video/mp4";

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mime,
          "X-Upload-Content-Length": String(stat.size),
        },
        body: JSON.stringify({
          snippet: { title, description, tags, categoryId: "28" },
          status: { privacyStatus, selfDeclaredMadeForKids: false },
        }),
      },
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`YouTube upload init failed: ${errText.slice(0, 400)}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return an upload URL");

    const fileBuf = fs.readFileSync(filePath);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mime, "Content-Length": String(stat.size) },
      body: fileBuf,
    });

    const result = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(result.error?.message || `Upload failed (${uploadRes.status})`);
    }

    const videoId = result.id;
    if (videoId && thumbnailPngBase64) {
      try {
        const thumbBuf = Buffer.from(thumbnailPngBase64, "base64");
        const thumbMime = thumbBuf[0] === 0xff && thumbBuf[1] === 0xd8 ? "image/jpeg" : "image/png";
        await setVideoThumbnail(accessToken, videoId, thumbBuf, thumbMime);
      } catch (thumbErr) {
        sendJson(res, 200, {
          videoId,
          url: videoId ? `https://youtu.be/${videoId}` : undefined,
          studioUrl: videoId ? `https://studio.youtube.com/video/${videoId}/edit` : undefined,
          thumbnailWarning: String(thumbErr.message || thumbErr),
        });
        return;
      }
    }
    sendJson(res, 200, {
      videoId,
      url: videoId ? `https://youtu.be/${videoId}` : undefined,
      studioUrl: videoId ? `https://studio.youtube.com/video/${videoId}/edit` : undefined,
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}

async function authFromBody(body) {
  const { clientId, clientSecret } = resolveYouTubeCreds(body);
  const refreshToken = String(body.refreshToken || "").trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("clientId, clientSecret, and refreshToken are required");
  }
  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  return { clientId, clientSecret, refreshToken, accessToken };
}

async function handleChannelGet(req, res) {
  try {
    const body = await readBody(req);
    const { accessToken } = await authFromBody(body);
    const channel = await fetchChannelDetails(accessToken);
    sendJson(res, 200, channel);
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}

async function handleChannelUpdate(req, res) {
  try {
    const body = await readBody(req);
    const { accessToken } = await authFromBody(body);
    const channelId = String(body.channelId || "").trim();
    const title = String(body.title ?? "").slice(0, 100);
    const description = String(body.description ?? "").slice(0, 1000);
    if (!channelId) {
      sendJson(res, 400, { error: "channelId is required" });
      return;
    }
    const updateRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          snippet: { title, description },
        }),
      },
    );
    const json = await updateRes.json();
    if (!updateRes.ok) {
      throw new Error(json.error?.message || `Channel update failed (${updateRes.status})`);
    }
    const item = json;
    sendJson(res, 200, {
      channelId: item.id,
      title: item.snippet?.title,
      description: item.snippet?.description,
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}

async function handleChannelVideos(req, res) {
  try {
    const body = await readBody(req);
    const { accessToken } = await authFromBody(body);
    const maxResults = Math.min(50, Math.max(1, Number(body.maxResults) || 25));
    const channel = await fetchChannelDetails(accessToken);
    const uploadsId = channel.uploadsPlaylistId;
    if (!uploadsId) {
      sendJson(res, 200, { videos: [] });
      return;
    }
    const itemsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsId)}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const itemsJson = await itemsRes.json();
    if (!itemsRes.ok) throw new Error(itemsJson.error?.message || "playlistItems.list failed");
    const videos = (itemsJson.items ?? []).map((it) => {
      const sn = it.snippet ?? {};
      const vid = sn.resourceId?.videoId ?? "";
      return {
        videoId: vid,
        title: sn.title ?? "",
        publishedAt: sn.publishedAt,
        thumbnailUrl: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
        url: vid ? `https://youtu.be/${vid}` : undefined,
      };
    });
    sendJson(res, 200, { videos, channelId: channel.channelId });
  } catch (e) {
    sendJson(res, 500, { error: String(e.message || e) });
  }
}

export function youtubeEndpointsPlugin() {
  return {
    name: "vibe-youtube-endpoints",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        if (url === "/api/youtube/oauth/start" && req.method === "POST") {
          handleOAuthStart(req, res);
          return;
        }
        if (url.startsWith("/api/youtube/oauth/callback") && req.method === "GET") {
          handleOAuthCallback(req, res, url);
          return;
        }
        if (url.startsWith("/api/youtube/oauth/poll") && req.method === "GET") {
          handleOAuthPoll(url, res);
          return;
        }
        if (url === "/api/youtube/renders" && req.method === "GET") {
          handleListRenders(res);
          return;
        }
        if (url === "/api/youtube/reveal-render" && req.method === "POST") {
          handleRevealRender(req, res);
          return;
        }
        if (url === "/api/youtube/upload" && req.method === "POST") {
          handleUpload(req, res);
          return;
        }
        if (url === "/api/youtube/channel" && req.method === "POST") {
          handleChannelGet(req, res);
          return;
        }
        if (url === "/api/youtube/channel/update" && req.method === "POST") {
          handleChannelUpdate(req, res);
          return;
        }
        if (url === "/api/youtube/channel/videos" && req.method === "POST") {
          handleChannelVideos(req, res);
          return;
        }

        next();
      });
    },
  };
}
