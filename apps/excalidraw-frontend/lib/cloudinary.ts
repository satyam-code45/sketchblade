import { HTTP_BACKEND } from "@/config";

export interface CloudinaryUploadResult {
  secure_url: string;
  width?: number;
  height?: number;
}

interface SignResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

// Cloudinary uploads are signed server-side (CLOUDINARY_API_SECRET never
// reaches the browser) but the file bytes go straight from the browser to
// Cloudinary — keeps large videos off our own server/serverless functions.
async function getUploadSignature(resourceType: "image" | "video"): Promise<SignResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${HTTP_BACKEND}/cloudinary/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { authorization: token } : {}),
    },
    body: JSON.stringify({ folder: `sketchblade/${resourceType}s` }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Couldn't get an upload signature from the server");
  }

  return res.json();
}

export async function uploadToCloudinary(
  file: File,
  resourceType: "image" | "video"
): Promise<CloudinaryUploadResult> {
  const { signature, timestamp, apiKey, cloudName, folder } = await getUploadSignature(resourceType);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Cloudinary upload failed (${res.status})`);
  }

  return res.json();
}

// Cloudinary can rasterize a still frame from a video URL — swap the delivery
// path to grab frame 0 and re-encode as a jpg, giving us a poster thumbnail.
export function cloudinaryVideoPoster(videoUrl: string): string {
  return videoUrl.replace("/upload/", "/upload/so_0/").replace(/\.[^./]+$/, ".jpg");
}
