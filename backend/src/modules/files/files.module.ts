import { BadRequestException, Global, Injectable, Module, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../config';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Detects image type from magic bytes — the client-declared mimetype is not trusted. */
export function sniffImage(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/** Private S3-compatible storage. Objects are never public; reads go through short-lived signed URLs. */
@Injectable()
export class FilesService {
  private client?: S3Client;
  private bucket: string;
  constructor(cfg: ConfigService) {
    const s3 = cfg.get<AppConfig['s3']>('s3')!;
    this.bucket = s3.bucket;
    if (s3.bucket && s3.accessKeyId && s3.secretAccessKey) {
      this.client = new S3Client({
        region: s3.region,
        endpoint: s3.endpoint || undefined,
        forcePathStyle: Boolean(s3.endpoint),
        credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
      });
    }
  }

  get configured() {
    return Boolean(this.client);
  }

  async uploadImage(prefix: string, file?: { buffer: Buffer; size: number }) {
    if (!file) throw new BadRequestException('file is required');
    if (file.size > MAX_UPLOAD_BYTES) throw new PayloadTooLargeException('Max 5 MB');
    const mime = sniffImage(file.buffer);
    if (!mime) throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');
    if (!this.client) throw new ServiceUnavailableException({ message: 'File storage is not configured', code: 'storage_not_configured' });
    const key = `${prefix}/${randomUUID()}.${mime.split('/')[1]}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: mime }));
    return { key, mime, size: file.size };
  }

  async signedUrl(key?: string | null, ttlSeconds = 300): Promise<string | null> {
    if (!key || !this.client) return null;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
  }
}

@Global()
@Module({ providers: [FilesService], exports: [FilesService] })
export class FilesModule {}
