import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

export const createUploadUrl = async (objectKey: string, mimeType: string): Promise<string> =>
  getSignedUrl(client, new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, ContentType: mimeType }), { expiresIn: 10 * 60 });

export const createDownloadUrl = async (objectKey: string): Promise<string> =>
  getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }), { expiresIn: 5 * 60 });

export const isTenantObjectKey = (objectKey: string, tenantId: string): boolean =>
  objectKey.startsWith(`tenants/${tenantId}/`) && !objectKey.includes("..");
