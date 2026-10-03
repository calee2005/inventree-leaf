export function formatQty(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 1000) / 1000);
}

export function formatStock(value: number, units: string): string {
  const qty = formatQty(value);
  const trimmed = units.trim();
  return trimmed ? `${qty} ${trimmed}` : qty;
}
