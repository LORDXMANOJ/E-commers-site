/**
 * Responsive image helpers. Unsplash and Pexels accept a `w` query param and Cloudinary takes a transform
 * segment, so one stored URL can produce a srcset. Other URLs are returned untouched.
 */
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
const isResizable = (url: string) =>
  url.includes("images.unsplash.com") || url.includes("images.pexels.com") || CLOUDINARY.test(url);

export function sized(url: string, width: number): string {
  if (!isResizable(url)) return url;
  const cloud = url.match(CLOUDINARY);
  if (cloud) return `${cloud[1]}c_limit,w_${width},f_auto,q_auto/${cloud[2]}`;
  const u = new URL(url);
  if (u.hostname === "images.pexels.com") {
    u.searchParams.set("w", String(width));
    u.searchParams.set("auto", "compress");
    u.searchParams.set("cs", "tinysrgb");
    return u.toString();
  }
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
