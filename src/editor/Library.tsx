import React from "react";
import { Check, X } from "lucide-react";
import { TEMPLATES, type Template } from "./templates";
import { InfographicTemplateThumb } from "./templates-infographic";
import { BACKGROUNDS, type BackgroundChoice } from "../styles/backgrounds";

// Simplified single-frame, white/gray representations of each template (reused by the
// in-player segment overlay).
export const TemplateThumb: React.FC<{ id: string }> = ({ id }) => {
  if (id === "women-in-tech") {
    return (
      <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="90" fill="#ffffff" />
        <g fill="none" stroke="#e3e3e7" strokeWidth="1">
          <circle cx="80" cy="45" r="16" />
          <circle cx="80" cy="45" r="30" />
          <circle cx="80" cy="45" r="44" />
        </g>
        <g fill="#cdcdd2">
          <circle cx="72" cy="38" r="7" />
          <circle cx="89" cy="41" r="7" />
          <circle cx="79" cy="52" r="6" />
          <g filter="url(#wit-blur)" opacity="0.7">
            <circle cx="50" cy="20" r="6" />
            <circle cx="112" cy="22" r="6" />
            <circle cx="38" cy="60" r="6" />
            <circle cx="122" cy="62" r="6" />
            <circle cx="80" cy="9" r="5" />
            <circle cx="80" cy="82" r="5" />
          </g>
        </g>
        <defs>
          <filter id="wit-blur">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
      </svg>
    );
  }
  if (id === "card-fade") {
    return (
      <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="90" fill="#ffffff" />
        <g fill="#cdcdd2">
          <rect x="20" y="28" width="26" height="40" rx="5" opacity="0.35" filter="url(#cf-blur)" />
          <rect x="114" y="28" width="26" height="40" rx="5" opacity="0.35" filter="url(#cf-blur)" />
          <rect x="66" y="22" width="28" height="46" rx="6" />
        </g>
        <defs>
          <filter id="cf-blur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
      </svg>
    );
  }
  return <InfographicTemplateThumb id={id} />;
};

interface LibraryProps {
  open: boolean;
  onClose: () => void;
  onDragTemplate?: (t: Template | null) => void;
  /** Currently selected animated background (null = classic dot-grid paper). */
  background?: BackgroundChoice | null;
  onPickBackground?: (choice: BackgroundChoice | null) => void;
}

const activeCardStyle: React.CSSProperties = {
  outline: "2px solid #e84a6f",
  outlineOffset: -2,
  borderRadius: 10,
};

// Classic dot-grid paper — rendered when no animated background is selected.
const DefaultBgThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#F7F3EC" />
    <defs>
      <pattern id="lib-defbg-p" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.1" fill="rgba(26,28,46,0.28)" />
      </pattern>
    </defs>
    <rect width="160" height="90" fill="url(#lib-defbg-p)" />
  </svg>
);

// Right-side drawer: draggable templates + switchable animated backgrounds.
export const Library: React.FC<LibraryProps> = ({
  open,
  onClose,
  onDragTemplate,
  background,
  onPickBackground,
}) => {
  if (!open) return null;
  return (
    <aside className="library">
      <div className="library-head">
        <span>Library</span>
        <button className="library-x" onClick={onClose} aria-label="Close library">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="library-hint">Drag a template onto the timeline to add a section.</p>
      <div className="library-grid">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="lib-card"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/template", t.id);
              e.dataTransfer.effectAllowed = "copy";
              onDragTemplate?.(t);
            }}
            onDragEnd={() => onDragTemplate?.(null)}
            title={`Drag “${t.name}” onto the timeline`}
          >
            <div className="lib-thumb">
              <TemplateThumb id={t.id} />
            </div>
            <div className="lib-card-name">{t.name}</div>
            <div className="lib-card-sub">{t.durationSec}s · drag to timeline</div>
          </div>
        ))}
      </div>

      {onPickBackground && (
        <>
          <div className="library-head" style={{ borderTop: "1px solid #202126" }}>
            <span>Backgrounds</span>
          </div>
          <p className="library-hint">
            Click to switch the animated background — applies to infographic videos.
          </p>
          <div className="library-grid">
            <div
              className="lib-card"
              role="button"
              style={background == null ? activeCardStyle : undefined}
              onClick={() => onPickBackground(null)}
              title="Classic dot-grid paper (default)"
            >
              <div className="lib-thumb" style={{ position: "relative" }}>
                <DefaultBgThumb />
                {background == null && <SelectedBadge />}
              </div>
              <div className="lib-card-name">Clean Paper · Static</div>
              <div className="lib-card-sub">default</div>
            </div>
            {BACKGROUNDS.map((b) => {
              const active = background?.id === b.id;
              return (
                <div
                  key={b.id}
                  className="lib-card"
                  role="button"
                  style={active ? activeCardStyle : undefined}
                  onClick={() => onPickBackground({ id: b.id, ...b.defaults })}
                  title={`Switch background to “${b.name}”`}
                >
                  <div className="lib-thumb" style={{ position: "relative" }}>
                    <b.thumb />
                    {active && <SelectedBadge />}
                  </div>
                  <div className="lib-card-name">{b.name}</div>
                  <div className="lib-card-sub">animated · click to apply</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
};

const SelectedBadge: React.FC = () => (
  <span
    style={{
      position: "absolute",
      top: 4,
      right: 4,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
      borderRadius: 999,
      background: "#e84a6f",
      color: "#fff",
    }}
  >
    <Check style={{ width: 12, height: 12 }} />
  </span>
);
