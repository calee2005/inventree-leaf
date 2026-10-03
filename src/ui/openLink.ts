export function openLink(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
