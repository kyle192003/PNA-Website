import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const PUBLIC_UPLOADS_BUCKET = "public-uploads";
export const PRIVATE_UPLOADS_BUCKET = "private-uploads";

export function usesSupabaseStorage(): boolean {
  return isSupabaseConfigured();
}

export async function uploadPublicFile(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.storage.from(PUBLIC_UPLOADS_BUCKET).upload(objectPath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Could not save file: ${error.message}`);
  }

  const { data } = supabase.storage.from(PUBLIC_UPLOADS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function uploadPrivateFile(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.storage.from(PRIVATE_UPLOADS_BUCKET).upload(objectPath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Could not save private file: ${error.message}`);
  }
}

export async function downloadPrivateFile(objectPath: string): Promise<Buffer | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(PRIVATE_UPLOADS_BUCKET).download(objectPath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteStorageObject(
  bucket: string,
  objectPath: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.storage.from(bucket).remove([objectPath]);
}

export async function clearStoragePrefix(bucket: string, prefix: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (error || !data?.length) return 0;

  const paths = data
    .filter((entry) => Boolean(entry.name))
    .map((entry) => (prefix ? `${prefix.replace(/\/$/, "")}/${entry.name}` : entry.name));
  if (paths.length === 0) return 0;

  const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
  if (removeError) {
    console.error(`[supabase/storage] failed clearing ${bucket}/${prefix}:`, removeError.message);
    return 0;
  }
  return paths.length;
}
