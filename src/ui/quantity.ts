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

export function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) {
    return "";
  }
  const text = amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${text}` : text;
}

export function stockValueLabel(inStock: number, min: string, max: string, currency: string): string {
  const low = Number(min);
  const high = Number(max);
  const hasLow = min.trim() !== "" && Number.isFinite(low);
  const hasHigh = max.trim() !== "" && Number.isFinite(high);
  if (!hasLow && !hasHigh) {
    return "";
  }
  const minValue = inStock * (hasLow ? low : high);
  const maxValue = inStock * (hasHigh ? high : low);
  if (Math.abs(minValue - maxValue) < 0.005) {
    return formatMoney(minValue, currency);
  }
  return `${formatMoney(minValue, currency)} – ${formatMoney(maxValue, currency)}`;
}
