import type { ReactNode } from "react";

export function Subpage({ children }: { children: ReactNode }) {
  return <div className="subpage">{children}</div>;
}
