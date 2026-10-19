'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { asset } from '@/lib/asset';
import { downloadMayOpenInstead, downloadScrapbook, imageType, prepareDogPhoto, saveImageFile, trialDownloadName } from '@/lib/sdcGallery';
import styles from './SdcCommunityGallery.module.css';

const MAX_TRIAL_PHOTOS = 12;

const scrapbook = [
  { src: '/memes/01.jpg', caption: 'morning routine' },
  { src: '/memes/02.jpg', caption: 'three more minutes' },
  { src: '/memes/03.jpg', caption: 'busy napping' },
  { src: '/memes/04.jpg', caption: 'gym day (nope)' },
  { src: '/memes/05.jpg', caption: 'do not disturb' },
  { src: '/memes/06.jpg', caption: 'dreaming of snacks' },
  { src: '/memes/07.jpg', caption: 'recharging' },
  { src: '/sdc/scrapbook/sleeping_shiba_on_a_cozy_sofa.png', caption: 'cozy sofa nap' },
  { src: '/sdc/scrapbook/sunlit_shiba_inu_nap.png', caption: 'sunlit belly nap' },
  { src: '/sdc/scrapbook/sleepy_shiba_inu_by_the_window.png', caption: 'window nap' },
  { src: '/sdc/scrapbook/sleepy_shiba_inu_road_trip.png', caption: 'road trip nap' },
  { src: '/sdc/scrapbook/sleepy_shiba_s_cozy_slipper_nap.png', caption: 'slipper nap' },
];

function scrapbookDownloadName(src: string, index: number) {
  const ext = src.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  return `sleepy-dog-scrapbook-${index + 1}.${ext}`;
}

type TrialPhoto = {
  id: string;
  dogName: string;
  caption: string;
  url: string;
  blob: Blob;
};

/** Session-only gallery. Photos never leave this browser tab. */
export default function SdcCommunityGallery() {
  const [photos, setPhotos] = useState<TrialPhoto[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dogName, setDogName] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
  }, []);
  useEffect(() => {
    const open = () => {
      setFormOpen(true);
      setActionError('');
      document.getElementById('sdc-upload-panel')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };
    window.addEventListener('sdc-open-upload', open);
    return () => window.removeEventListener('sdc-open-upload', open);
  }, []);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function chooseFile(next: File | null) {
    setActionError('');
    if (!next) { setFile(null); return; }
    if (!imageType(next)) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setActionError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (next.size > 8 * 1024 * 1024) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setActionError('Please choose a photo smaller than 8 MB.');
      return;
    }
    setFile(next);
  }

  async function addPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError('');
    setMessage('');
    const name = dogName.trim();
    if (!file) { setActionError('Choose a photo first.'); return; }
    if (!name || name.length > 48) { setActionError('Enter a dog name (1–48 characters).'); return; }
    if (caption.trim().length > 220) { setActionError('Caption must be 220 characters or fewer.'); return; }
    if (photos.length >= MAX_TRIAL_PHOTOS) { setActionError(`This trial keeps up to ${MAX_TRIAL_PHOTOS} photos in this tab. Remove one to add another.`); return; }
    setBusy(true);
    try {
      const blob = await prepareDogPhoto(file);
      const photo: TrialPhoto = {
        id: crypto.randomUUID(),
        dogName: name,
        caption: caption.trim(),
        blob,
        url: URL.createObjectURL(blob),
      };
      setPhotos((current) => [photo, ...current]);
      setMessage(`${name} was added to your temporary gallery. Only you can see it, and it disappears if you refresh or leave.`);
      setFile(null);
      setDogName('');
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'That photo could not be added.');
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(photo: TrialPhoto) {
    URL.revokeObjectURL(photo.url);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    setMessage(`${photo.dogName} was removed from this browser session.`);
  }

  async function downloadTrial(photo: TrialPhoto) {
    setActionError('');
    try {
      await saveImageFile(photo.blob, trialDownloadName(photo.dogName, photo.id));
      const extra = downloadMayOpenInstead() ? ' If it opened instead of saving, use your browser’s Save Image or Share control.' : '';
      setMessage(`${photo.dogName} download started.${extra}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Download failed.');
    }
  }

  async function downloadSample(url: string, filename: string, label: string) {
    setActionError('');
    try {
      await downloadScrapbook(url, filename);
      const extra = downloadMayOpenInstead() ? ' If it opened instead of saving, use your browser’s Save Image or Share control.' : '';
      setMessage(`${label} download started.${extra}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Download failed.');
    }
  }

  return (
    <section className={styles.gallery} id="sdc-gallery" aria-labelledby="sdc-gallery-title">
      <div className={styles.topline}><span>04 / the nap club</span><span>REAL DOGS · REAL NAPS · ZERO HUSTLE</span></div>
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>WELCOME TO THE INTERNET&apos;S COZIEST CORNER</p>
          <h2 id="sdc-gallery-title">The Sleepy<br/><em>Dogs Club.</em></h2>
          <div className={styles.ticker}>$ZZZPUPS <span>on Ethereum</span></div>
          <p className={styles.intro}>Got a sleepy dog? Show us!</p>
          <div className={styles.ctas}>
            <button type="button" className={styles.primary} onClick={() => { setFormOpen((open) => !open); setActionError(''); }} aria-expanded={formOpen} aria-controls="sdc-upload-panel">
              {formOpen ? 'Close the form' : 'Add Your Sleeping Dog'} <span aria-hidden="true">↗</span>
            </button>
            <a href="#sdc-trial-gallery" className={styles.secondary}>Your temporary gallery ↓</a>
          </div>
        </div>
        <div className={styles.artwork}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset('/sdc/brand/sleepy-pack-art.jpg')} alt="Illustration of three cozy sleeping pups beneath a moonlit sky" loading="lazy" />
          <span>every nap deserves a post.</span>
        </div>
      </div>
      {message && <p className={styles.success} role="status">{message}</p>}
      {actionError && <p className={styles.error} role="alert">{actionError}</p>}
      <div id="sdc-upload-panel">
        {formOpen && (
          <div className={styles.uploadPanel}>
            <div className={styles.formHeading}><h3>Add Your Sleeping Dog</h3><p>This stays on your screen only. Nothing is uploaded.</p></div>
            <form onSubmit={(event) => { void addPhoto(event); }} className={styles.form}>
              <label
                className={`${styles.filePicker}${dragging ? ` ${styles.dragging}` : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0] || null); }}
              >
                <span>{file ? file.name : 'Choose a photo of your sleeping dog'}</span>
                <small>JPG, PNG, or WebP · drag a file here or use your camera roll · resized in your browser · camera location removed</small>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
              </label>
              {preview && (
                <div className={styles.preview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview of your selected dog photo" />
                </div>
              )}
              <label>Dog&apos;s name <span>*</span><input value={dogName} required maxLength={48} onChange={(event) => setDogName(event.target.value)} placeholder="e.g. Mochi" /></label>
              <label>Caption (optional)<textarea value={caption} maxLength={220} rows={3} onChange={(event) => setCaption(event.target.value)} placeholder="Give this ridiculous nap a title…" /></label>
              <div className={styles.formBottom}><span>Up to {MAX_TRIAL_PHOTOS} photos in this visit. Other visitors cannot see them.</span><button type="submit" disabled={busy}>{busy ? 'Preparing…' : 'Add to Gallery'}</button></div>
            </form>
          </div>
        )}
      </div>
      <div className={styles.galleryHead} id="sdc-trial-gallery">
        <div>
          <h3>Your Temporary Nap Gallery<span>.</span></h3>
        </div>
      </div>
      {photos.length === 0 ? (
        <div className={styles.placeholder}><strong>No temporary photos yet.</strong></div>
      ) : (
        <div className={styles.photoGrid}>
          {photos.map((photo) => (
            <article key={photo.id} className={styles.photoCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`${photo.dogName} sleeping. ${photo.caption}`} />
              <div className={styles.photoDetails}><strong>{photo.dogName}</strong><small>visible only in this tab</small>{photo.caption && <p>{photo.caption}</p>}</div>
              <div className={styles.photoActions}>
                <button type="button" onClick={() => void downloadTrial(photo)} aria-label={`Download photo of ${photo.dogName}`}>Download Photo</button>
                <button type="button" className={styles.remove} onClick={() => removePhoto(photo)} aria-label={`Remove photo of ${photo.dogName}`}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className={styles.scrapbookHead}><h3>From our scrapbook</h3><p>Existing site photos · not photos added by visitors</p></div>
      <div className={styles.scrapbook}>
        {scrapbook.map((photo, index) => (
          <article key={photo.src} className={styles.scrapbookCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(photo.src)} alt={`Sleepy dog scrapbook photo ${index + 1}: ${photo.caption}`} loading="lazy" />
            <div><span>{photo.caption}</span><button type="button" onClick={() => void downloadSample(asset(photo.src), scrapbookDownloadName(photo.src, index), photo.caption)} aria-label={`Download scrapbook photo ${index + 1}`}>Download Photo</button></div>
          </article>
        ))}
      </div>
      <div className={styles.lastLine}><span>REAL PUPS, REAL PEOPLE.</span><strong>EVERY NAP DESERVES A POST.</strong><span>EST. NAP O&apos;CLOCK ☾</span></div>
    </section>
  );
}
