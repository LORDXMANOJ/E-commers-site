import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { post } from "../../lib/api";
import { Button } from "../../components/ui/Button";

type Signature = {
  uploadUrl: string;
  apiKey: string;
  signature: string;
  timestamp: string;
  folder: string;
  allowed_formats: string;
};

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Uploads straight from the browser to Cloudinary with a signature from our API, so the API secret stays on
 * the server and files never touch Render's temporary disk. Returns the HTTPS URLs of the uploaded images.
 */
export function ImageUploader({ enabled, onUploaded }: { enabled: boolean; onUploaded: (urls: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  if (!enabled) {
    return (
      <p className="text-sm text-muted">
        Image upload is off. Add the Cloudinary keys to the API settings to enable it, or paste image URLs below.
      </p>
    );
  }

  const upload = async (files: FileList) => {
    const list = Array.from(files).slice(0, 8);
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(", ")} is over 8 MB and was skipped`);
    const ok = list.filter((f) => f.size <= MAX_BYTES && f.type.startsWith("image/"));
    if (!ok.length) return;
    setBusy(ok.length);
    const urls: string[] = [];
    for (const file of ok) {
      try {
        const sig = await post<Signature>("/admin/uploads/signature");
        const body = new FormData();
        body.append("file", file);
        body.append("api_key", sig.apiKey);
        body.append("timestamp", sig.timestamp);
        body.append("signature", sig.signature);
        body.append("folder", sig.folder);
        body.append("allowed_formats", sig.allowed_formats);
        const res = await fetch(sig.uploadUrl, { method: "POST", body });
        const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
        if (!res.ok || !data.secure_url) throw new Error(data.error?.message ?? "Upload failed");
        urls.push(data.secure_url);
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (urls.length) {
      onUploaded(urls);
      toast.success(urls.length === 1 ? "Image uploaded" : `${urls.length} images uploaded`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="secondary" onClick={() => input.current?.click()} loading={busy > 0}>
        <ImagePlus className="size-4" aria-hidden /> {busy > 0 ? `Uploading ${busy}…` : "Upload images"}
      </Button>
      <p className="text-sm text-muted">JPG, PNG, WebP or AVIF, up to 8 MB each. Portrait 4:5 photos look best.</p>
    </div>
  );
}
