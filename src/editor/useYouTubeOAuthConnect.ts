import { useRef, useState } from "react";
import type { Settings } from "./settings";
import {
  fetchYouTubeOAuthResult,
  startYouTubeOAuth,
  waitForYouTubeOAuth,
  YOUTUBE_OAUTH_STATE_KEY,
} from "./ai/youtube";
import { addYouTubeChannelFromOAuth, getYouTubeOAuthCreds, hasYouTubeChannels } from "./youtubeChannels";

export function useYouTubeOAuthConnect(
  settings: Settings,
  onChange: (next: Settings) => void,
) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const oauthStateRef = useRef<string | null>(null);

  const creds = getYouTubeOAuthCreds(settings);
  const needsCredentials = !creds.clientId.trim() || !creds.clientSecret.trim();

  const applyOAuthResult = (
    result: Awaited<ReturnType<typeof fetchYouTubeOAuthResult>>,
    fallback: { clientId: string; clientSecret: string },
  ) => {
    if (!result?.ok || !result.refreshToken) {
      throw new Error(result?.error || "YouTube sign-in was cancelled.");
    }
    onChange(
      addYouTubeChannelFromOAuth(settings, {
        refreshToken: result.refreshToken,
        channelTitle: result.channelTitle,
        youtubeChannelId: result.youtubeChannelId,
        thumbnailUrl: result.thumbnailUrl,
        clientId: result.clientId || fallback.clientId,
        clientSecret: result.clientSecret || fallback.clientSecret,
      }),
    );
    sessionStorage.removeItem(YOUTUBE_OAUTH_STATE_KEY);
    oauthStateRef.current = null;
  };

  const connect = async () => {
    setError("");
    const clientId = creds.clientId.trim();
    const clientSecret = creds.clientSecret.trim();
    if (!clientId || !clientSecret) {
      setError("Enter OAuth Client ID and Secret in Settings → YouTube first.");
      return false;
    }
    setConnecting(true);
    try {
      const { url, state } = await startYouTubeOAuth({ clientId, clientSecret });
      oauthStateRef.current = state;
      sessionStorage.setItem(YOUTUBE_OAUTH_STATE_KEY, state);
      const waitPromise = waitForYouTubeOAuth(state);
      const popup = window.open(url, "vibe-youtube-oauth", "width=520,height=720");
      if (!popup) throw new Error("Popup blocked — allow popups for this site.");
      const result = await waitPromise;
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      applyOAuthResult(result, { clientId, clientSecret });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setConnecting(false);
    }
  };

  const manualComplete = async () => {
    const state = oauthStateRef.current || sessionStorage.getItem(YOUTUBE_OAUTH_STATE_KEY);
    if (!state) {
      setError("No sign-in in progress — click Add channel first.");
      return false;
    }
    setError("");
    setConnecting(true);
    const clientId = creds.clientId.trim();
    const clientSecret = creds.clientSecret.trim();
    try {
      const result = await fetchYouTubeOAuthResult(state, { attempts: 15, intervalMs: 400 });
      if (!result) {
        throw new Error("Still waiting — finish Google sign-in, then try again.");
      }
      applyOAuthResult(result, { clientId, clientSecret });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setConnecting(false);
    }
  };

  return {
    connect,
    manualComplete,
    connecting,
    error,
    setError,
    needsCredentials,
    hasChannels: hasYouTubeChannels(settings),
  };
}
