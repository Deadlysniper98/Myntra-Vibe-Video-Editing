import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PROJECT_SORT_OPTIONS, type ProjectSortKey } from "./projectListFilters";

interface FolderSortMenuProps {
  value: ProjectSortKey;
  onChange: (value: ProjectSortKey) => void;
}

export const FolderSortMenu: React.FC<FolderSortMenuProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current =
    PROJECT_SORT_OPTIONS.find((opt) => opt.value === value) ?? PROJECT_SORT_OPTIONS[0];

  return (
    <div className="folder-sort-menu" ref={rootRef}>
      <button
        type="button"
        className="folder-sort-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Sort videos"
      >
        <span className="folder-sort-label">Sort</span>
        <span className="folder-sort-menu-value">{current.label}</span>
        <ChevronDown
          className={`folder-sort-menu-chevron h-3.5 w-3.5${open ? " folder-sort-menu-chevron--open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul className="folder-sort-menu-list" role="listbox" aria-label="Sort options">
          {PROJECT_SORT_OPTIONS.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`folder-sort-menu-option${selected ? " folder-sort-menu-option--active" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
