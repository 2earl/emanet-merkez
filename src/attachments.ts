/**
 * Files on a support message (emanet-core docs/DESIGN.md §20): up to three photos or PDFs of at
 * most 10 MB each. What a file is comes from its first bytes, never from its name or the browser's
 * word for it. Files go into the evidence bucket under `support/<uuid>`; core records them, and if
 * core refuses the message the stored copies are removed again.
 */

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface AttachmentInput {
  file_ref: string;
  name: string;
  content_type: string;
  size: number;
  sha256: string;
}

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false; error: string };

function fileType(bytes: Uint8Array): string | null {
  const at = (offset: number, ...sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  const ascii = (offset: number, text: string) =>
    Array.from(text).every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['heic', 'heix', 'hevc', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  if (ascii(0, '%PDF-')) return 'application/pdf';
  return null;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The files chosen in a form (`files`, possibly several), checked and stored; or why not. */
export async function storeAttachments(
  bucket: R2Bucket,
  values: unknown[],
  owner: string,
): Promise<Ok<AttachmentInput[]> | Fail> {
  const files = values.filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length > MAX_FILES) return { ok: false, error: 'too_many_files' };
  const checked: { file: File; bytes: Uint8Array; type: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'file_too_large' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = fileType(bytes);
    if (!type) return { ok: false, error: 'file_type' };
    checked.push({ file, bytes, type });
  }
  const stored: AttachmentInput[] = [];
  for (const { file, bytes, type } of checked) {
    const ref = `support/${crypto.randomUUID()}`;
    await bucket.put(ref, bytes, {
      httpMetadata: { contentType: type },
      customMetadata: { owner },
    });
    stored.push({
      file_ref: ref,
      name: file.name || 'file',
      content_type: type,
      size: bytes.byteLength,
      sha256: await sha256(bytes),
    });
  }
  return { ok: true, value: stored };
}

/** Core refused the message: the files stored for it go too. */
export async function dropAttachments(bucket: R2Bucket, files: AttachmentInput[]): Promise<void> {
  await Promise.all(files.map((f) => bucket.delete(f.file_ref)));
}

/**
 * One stored file, as a response: a picture shown in the page, a PDF downloaded. Sandboxed, so a
 * file can never run anything on this site.
 */
export async function attachmentResponse(
  bucket: R2Bucket,
  file: { file_ref: string; name: string; content_type: string },
): Promise<Response | null> {
  const object = await bucket.get(file.file_ref);
  if (!object) return null;
  const image = file.content_type.startsWith('image/');
  const name = file.name.replace(/[^A-Za-z0-9._ -]/g, '_') || 'file';
  return new Response(object.body, {
    headers: {
      'Content-Type': file.content_type,
      'Content-Disposition': `${image ? 'inline' : 'attachment'}; filename="${name}"`,
      // The app's policy is added to this; `sandbox` keeps any file from running on this site.
      'Content-Security-Policy': 'sandbox',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}

/** A file's size in words: "240 KB", "3.1 MB". */
export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
