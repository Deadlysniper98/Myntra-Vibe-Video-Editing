export interface YouTubePublishDefaults {
  title: string;
  description: string;
  tags: string;
}

const BY_COMP: Record<string, YouTubePublishDefaults> = {
  MyComp: {
    title: "MynnovAIte Promo — Hackerramp Brand Reel",
    description: "Brand promo reel for MynnovAIte / Hackerramp — event-ready motion graphics built with Remotion.",
    tags: "mynnovaiite, hackerramp, myntra, promo, brand video, remotion",
  },
  MyCompVertical: {
    title: "MynnovAIte Promo (Vertical)",
    description: "Vertical cut of the MynnovAIte / Hackerramp brand promo.",
    tags: "mynnovaiite, myntra, vertical, promo, shorts",
  },
  MyCompUltrawide: {
    title: "MynnovAIte Promo (Ultrawide)",
    description: "Ultrawide cut of the MynnovAIte / Hackerramp brand promo.",
    tags: "mynnovaiite, myntra, ultrawide, promo, brand video",
  },
};

export function getYouTubePublishDefaults(compId: string, projectName?: string): YouTubePublishDefaults {
  const curated = BY_COMP[compId];
  if (curated) return curated;
  const name = (projectName ?? compId.replace(/([A-Z])/g, " $1").trim()).trim();
  return { title: name, description: `${name}\n\nCreated with Myntra Vibe Video Editing.`, tags: "myntra, vibe video, remotion" };
}
