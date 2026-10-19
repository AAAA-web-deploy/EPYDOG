import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** This module is safe for a statically exported Next.js site.
 * The publishable key is intentionally public. NEVER put a service-role key here.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
export const galleryConfigured = Boolean(url && publishableKey);
export const PHOTO_BUCKET = 'sleepy-dogs-private';
let galleryClient: SupabaseClient | null = null;

export function getSdcClient(): SupabaseClient | null {
  if (!galleryConfigured) return null;
  if (!galleryClient) galleryClient = createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return galleryClient;
}

export type SdcPhoto = {
  id: string;
  dog_name: string;
  display_name: string;
  caption: string;
  storage_path: string;
  created_at: string;
  imageUrl: string;
};

type StoredPhoto = Omit<SdcPhoto, 'imageUrl'>;

/** Only approved images are queried. SQL policies also enforce this. */
export async function listApprovedPhotos(): Promise<SdcPhoto[]> {
  const client = getSdcClient();
  if (!client) return [];
  const { data, error } = await client
    .from('sdc_photos')
    .select('id,dog_name,display_name,caption,storage_path,created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(48);
  if (error) throw error;
  const photos = (data || []) as StoredPhoto[];
  const signed = await Promise.all(photos.map(async (photo) => {
    const result = await client.storage.from(PHOTO_BUCKET).createSignedUrl(photo.storage_path, 3600);
    return result.error || !result.data?.signedUrl ? null : { ...photo, imageUrl: result.data.signedUrl };
  }));
  return signed.filter((photo): photo is SdcPhoto => photo !== null);
}

export async function getOrCreateAnonymousUser(): Promise<string> {
  const client = getSdcClient();
  if (!client) throw new Error('Photo uploads are not configured yet.');
  const { data: existing, error: sessionError } = await client.auth.getUser();
  if (!sessionError && existing.user?.id) return existing.user.id;
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user?.id) {
    throw new Error(error?.message || 'Cannot start a guest upload session. Check Anonymous Sign-ins and CAPTCHA settings.');
  }
  return data.user.id;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function imageType(file: File): string {
  if (ALLOWED_TYPES.includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  return ''
}

/** Canvas export strips camera EXIF/GPS metadata. Actual content is JPEG, not SVG. */
export async function prepareDogPhoto(file: File): Promise<Blob> {
  if (!imageType(file)) {
    throw new Error('Please choose a JPG, PNG, or WebP image.')
  }
  if (file.size > 12 * 1024 * 1024) throw new Error('The original photo must be smaller than 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 150 || bitmap.height < 150) throw new Error('Please use a photo at least 150 × 150 pixels.');
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser cannot process this image.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not prepare the photo.');
    if (blob.size > 5 * 1024 * 1024) throw new Error('Photo is too large after processing. Try a smaller image.');
    return blob;
  } finally {
    bitmap.close();
  }
}

export type UploadInput = {
  file: File;
  dogName: string;
  displayName: string;
  caption: string;
};

export async function submitDogPhoto(input: UploadInput, onStage?: (stage: string) => void): Promise<void> {
  const client = getSdcClient();
  if (!client) throw new Error('Photo uploads are not configured yet.');
  onStage?.('Checking the photo…');
  const ownerId = await getOrCreateAnonymousUser();
  const dogName = input.dogName.trim();
  const displayName = input.displayName.trim() || 'a sleepy dog parent';
  const caption = input.caption.trim();
  if (!dogName || dogName.length > 48) throw new Error('Enter a dog name (1–48 characters).');
  if (displayName.length > 40) throw new Error('Your display name must be 40 characters or fewer.');
  if (caption.length > 220) throw new Error('Caption must be 220 characters or fewer.');
  const photo = await prepareDogPhoto(input.file);
  onStage?.('Uploading to private storage…');
  const path = `${ownerId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await client.storage.from(PHOTO_BUCKET).upload(path, photo, {
    contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
  });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
  onStage?.('Saving the submission…');
  const { error: insertError } = await client.from('sdc_photos').insert({
    uploader_id: ownerId, storage_path: path, dog_name: dogName,
    display_name: displayName, caption, status: 'pending',
  });
  if (insertError) {
    // Delete the unsubmitted image if metadata creation fails, minimizing orphan files.
    await client.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(`Could not submit the photo: ${insertError.message}`);
  }
}

export function memberDownloadName(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80) || 'photo'
  return `sleepy-dog-${safe}.jpg`
}

export function downloadMayOpenInstead(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent)
}

export async function saveImageFile(data: Blob, filename: string): Promise<void> {
  const head = new Uint8Array(await data.slice(0, 12).arrayBuffer())
  const jpeg = head[0] === 0xff && head[1] === 0xd8
  const png = head[0] === 0x89 && head[1] === 0x50
  const webp = head[8] === 0x57 && head[9] === 0x45
  if (!data.type.startsWith('image/') && !jpeg && !png && !webp) {
    throw new Error('The download was not an image file.')
  }
  const objUrl = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = objUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objUrl), 30000)
}

export async function downloadScrapbook(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('That scrapbook photo could not be downloaded.')
  await saveImageFile(await response.blob(), filename)
}

export async function downloadApprovedPhoto(photo: SdcPhoto): Promise<void> {
  const client = getSdcClient();
  if (!client) throw new Error('Downloads are temporarily unavailable.');
  // Storage RLS enforces approved-photo-only downloads; not a public bucket.
  const { data, error } = await client.storage.from(PHOTO_BUCKET).download(photo.storage_path);
  if (error || !data) throw new Error(error?.message || 'Download failed. Pending and rejected photos stay private.');
  await saveImageFile(data, memberDownloadName(photo.id));
}

export async function reportApprovedPhoto(photoId: string): Promise<void> {
  const client = getSdcClient();
  if (!client) throw new Error('Reports are temporarily unavailable.');
  const reporterId = await getOrCreateAnonymousUser();
  const { error } = await client.from('sdc_reports').insert({ photo_id: photoId, reporter_id: reporterId, reason: 'community report' });
  if (error) throw new Error(error.message);
}
