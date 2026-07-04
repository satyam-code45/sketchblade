import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserId } from "@/lib/api-auth";

// Signs an upload request server-side so CLOUDINARY_API_SECRET never reaches
// the browser. The client then uploads the file directly to Cloudinary using
// this signature — the file itself never passes through our server.
export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { message: "Cloudinary isn't configured on the server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const folder: string = typeof body.folder === "string" ? body.folder : "sketchblade";

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key as keyof typeof paramsToSign]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder });
}
