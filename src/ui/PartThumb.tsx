import { useEffect, useState } from "react";
import { loadPartThumbnail } from "../api";

export function PartThumb({ serverId, thumbnail }: { serverId: string; thumbnail: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnail.trim()) {
      setSrc(null);
      return;
    }
    let active = true;
    loadPartThumbnail(serverId, thumbnail)
      .then((url) => {
        if (active) {
          setSrc(url);
        }
      })
      .catch(() => {
        if (active) {
          setSrc(null);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId, thumbnail]);

  return (
    <div className="part-thumb">
      {src ? <img alt="" src={src} /> : <ImageIcon />}
    </div>
  );
}

function ImageIcon() {
  return (
    <svg className="thumb-fallback" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.2" />
      <path d="M7 16l3.2-3.2 2.2 2.2L16 11.5 19 15" />
    </svg>
  );
}
