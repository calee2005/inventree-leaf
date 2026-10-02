import type { CommandFailure } from "./types";

export function Notice({ error }: { error: CommandFailure | null }) {
  if (!error) {
    return null;
  }
  return <p className={`notice ${error.kind}`}>{error.message}</p>;
}
