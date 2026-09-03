import React from "react";
import { Audio, Sequence, staticFile, interpolate } from "remotion";

// Key-moment sound design (real composition frames — the audio layer is unaffected
// by the 2× virtual frame space the visuals use internally).
type Hit = { from: number; src: string; volume: number; label: string };

const HITS: Hit[] = [
  { from: 131, src: "sfx/mouse-click.wav", volume: 0.6,  label: "cursor click — Create a squad" },
  { from: 140, src: "sfx/whoosh.wav",      volume: 0.5,  label: "intro lifts away" },
  { from: 298, src: "sfx/whoosh.wav",      volume: 0.5,  label: "squad rises" },
  { from: 547, src: "sfx/whoosh.wav",      volume: 0.55, label: "prize cards rise" },
  { from: 675, src: "sfx/whoosh.wav",      volume: 0.5,  label: "speakers carousel enters" },
  { from: 727, src: "sfx/whoosh.wav",      volume: 0.32, label: "carousel slide → speaker 2" },
  { from: 775, src: "sfx/whoosh.wav",      volume: 0.32, label: "carousel slide → speaker 3" },
  { from: 840, src: "sfx/whoosh.wav",      volume: 0.5,  label: "WiT orbital ripples in" },
  { from: 955, src: "sfx/whip.wav",        volume: 0.5,  label: "Register stamps in" },
];

interface AudioProps {
  masterVolume?: number;
  sfxVolume?: number;
  musicVolume?: number;
}

export const SfxLayer: React.FC<{ audio?: AudioProps }> = ({ audio }) => {
  const master = audio?.masterVolume ?? 1;
  const music  = audio?.musicVolume  ?? 1;
  const sfx    = audio?.sfxVolume    ?? 1;

  return (
    <>
      {/* Fun tech background music — gentle fade-in at the open, fade-out into the close.
          Kept low so the key SFX still punch through. */}
      <Audio
        src={staticFile("music/silicon-pulse.mp3")}
        volume={(f) =>
          interpolate(f, [0, 24, 1034, 1059], [0, 0.3, 0.3, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) * music * master
        }
      />
      {HITS.map((h, i) => (
        <Sequence key={i} from={h.from} name={`sfx: ${h.label}`}>
          <Audio src={staticFile(h.src)} volume={h.volume * sfx * master} />
        </Sequence>
      ))}
    </>
  );
};
