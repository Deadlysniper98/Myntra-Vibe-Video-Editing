import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface EffectGroupProps {
  title: string;
  badge?: string;       // short value summary shown in the header when collapsed
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const EffectGroup: React.FC<EffectGroupProps> = ({
  title,
  badge,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="effect-group" data-open={open}>
      <button className="effect-group-head" onClick={() => setOpen((o) => !o)}>
        <ChevronDown className="effect-group-chevron" />
        <span className="effect-group-title">{title}</span>
        {badge && <span className="effect-group-badge">{badge}</span>}
      </button>
      {open && <div className="effect-group-body">{children}</div>}
    </div>
  );
};
