/**
 * Responsive image helpers. Unsplash (and many CDNs) accept a `w` query param, so we can build a
 * srcset from one stored URL. Other URLs are returned untouched.
 */
const isResizable = (url: string) => url.includes("images.unsplash.com");

export function sized(url: string, width: number): string {
  if (!isResizable(url)) return url;
  const u = new URL(url);
  u.searchParams.set("w", String(width));
  u.searchParams.set("auto", "format");
  u.searchParams.set("fit", "crop");
  if (!u.searchParams.has("q")) u.searchParams.set("q", "75");
  return u.toString();
}

export function srcSet(url: string, widths = [320, 480, 640, 800, 1080, 1400]): string | undefined {
  if (!isResizable(url)) return undefined;
  return widths.map((w) => `${sized(url, w)} ${w}w`).join(", ");
}
