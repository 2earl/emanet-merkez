import { createApp } from './app';
import { core } from './core';

/** Emanet Merkez at merkez.emanet.dev (emanet-core docs/DESIGN.md §7). */

const now = () => Math.floor(Date.now() / 1000);
const app = createApp(now);

/**
 * Deletes the files the core has queued (a data subject's request, a deleted account, the end of
 * a retention period) from the two buckets, then tells the core which are gone. Emanet Merkez
 * holds the buckets; the core decides what goes (emanet-core src/privacy.ts).
 */
export async function eraseDueFiles(env: Env): Promise<number> {
  const sealed = await archiveDueFiles(env);
  const due = await core(env).filesDue(200);
  if (!due.ok || due.value.length === 0) return sealed;
  const gone: string[] = [];
  for (const file of due.value) {
    const bucket = file.bucket === 'evidence' ? env.EVIDENCE : env.DOCUMENTS;
    // Deleting an object that is already gone succeeds, so a repeat is harmless.
    await bucket.delete(file.file_ref);
    gone.push(file.file_ref);
  }
  await core(env).filesErased(gone);
  return gone.length + sealed;
}

/**
 * Files of an erased agent that go to the sealed archive: the core seals the bytes (it holds the
 * key), the sealed copy is stored under archive/, and only then is the original deleted. A file
 * that fails stays where it is and is tried again on the next run.
 */
export async function archiveDueFiles(env: Env): Promise<number> {
  const due = await core(env).archiveFilesDue(25);
  if (!due.ok) return 0;
  let done = 0;
  for (const file of due.value) {
    const bucket = file.bucket === 'evidence' ? env.EVIDENCE : env.DOCUMENTS;
    const object = await bucket.get(file.file_ref);
    if (!object) {
      // Nothing to seal: the original is already gone.
      await core(env).filesErased([file.file_ref]);
      continue;
    }
    const type = object.httpMetadata?.contentType ?? 'application/octet-stream';
    const sealed = await core(env).sealArchiveFile(
      file.archive_id,
      file.file_ref,
      await object.arrayBuffer(),
    );
    if (!sealed.ok) continue;
    const ref = `archive/${file.archive_id}/${crypto.randomUUID()}`;
    await env.EVIDENCE.put(ref, sealed.value, {
      httpMetadata: { contentType: 'application/octet-stream' },
      customMetadata: { archive: file.archive_id },
    });
    const stored = await core(env).archiveFileStored(file.archive_id, file.file_ref, {
      ref,
      type,
      size: sealed.value.byteLength,
    });
    if (!stored.ok) {
      await env.EVIDENCE.delete(ref);
      continue;
    }
    await bucket.delete(file.file_ref);
    done++;
  }
  return done;
}

export default {
  fetch: app.fetch,

  // Every ten minutes.
  scheduled(_controller, env, ctx): void {
    ctx.waitUntil(
      (async () => {
        try {
          await eraseDueFiles(env);
          await core(env).heartbeat('erase_files', null);
        } catch (error) {
          const name = error instanceof Error ? error.name : 'error';
          console.error(JSON.stringify({ level: 'error', event: 'cron.erase_files', error: name }));
          try {
            await core(env).reportError('cron.erase_files', name);
            await core(env).heartbeat('erase_files', name);
          } catch {
            // The core is what failed; the log line stands.
          }
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
