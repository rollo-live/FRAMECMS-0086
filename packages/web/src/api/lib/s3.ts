import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ChecksumAlgorithm } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 600) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

// Cache presigned GET url — riduciamo firma ripetuta (durano 1h, cachaimo 50min)
const presignedCache = new Map<string, { url: string; expiresAt: number }>();

export async function getPresignedGetUrl(key: string, expiresIn = 3600) {
  const now = Date.now();
  const cached = presignedCache.get(key);
  if (cached && cached.expiresAt > now) return cached.url;

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    { expiresIn }
  );
  // Caccha per expiresIn - 10min di margine
  presignedCache.set(key, { url, expiresAt: now + (expiresIn - 600) * 1000 });
  // Pulizia cache ogni 500 entry
  if (presignedCache.size > 500) {
    for (const [k, v] of presignedCache) {
      if (v.expiresAt < now) presignedCache.delete(k);
    }
  }
  return url;
}

export async function deleteObject(key: string) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}
