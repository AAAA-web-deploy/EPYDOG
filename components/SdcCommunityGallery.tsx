'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { asset } from '@/lib/asset';
import {
  downloadApprovedPhoto, galleryConfigured, listApprovedPhotos, reportApprovedPhoto,
  submitDogPhoto, type SdcPhoto,
} from '@/lib/sdcGallery';
import styles from './SdcCommunityGallery.module.css';

const scrapbook = [
  { src: '/memes/01.jpg', caption: 'morning routine' },
  { src: '/memes/02.jpg', caption: 'three more minutes' },
  { src: '/memes/03.jpg', caption: 'busy napping' },
  { src: '/memes/04.jpg', caption: 'gym day (nope)' },
  { src: '/memes/05.jpg', caption: 'do not disturb' },
  { src: '/memes/06.jpg', caption: 'dreaming of snacks' },
  { src: '/memes/07.jpg', caption: 'recharging' },
];

function dateLabel(value: string) {
  try { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

/** Additive community section. Does not replace hero, nap video, existing corkboard, or radio. */
export default function SdcCommunityGallery() {
  const [photos, setPhotos] = useState<SdcPhoto[]>([]);
  const [loading, setLoading] = useState(galleryConfigured);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dogName, setDogName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [caption, setCaption] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!galleryConfigured) return;
    setLoading(true);
    setLoadError('');
    try { setPhotos(await listApprovedPhotos()); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load community photos.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(''); setMessage('');
    if (!file) { setActionError('Choose a photo first.'); return; }
    if (!consent) { setActionError('Please confirm that you own the photo and permit sharing and downloading.'); return; }
    if (!galleryConfigured) { setActionError('Uploads are not connected to photo storage yet.'); return; }
    setBusy(true);
    try {
      await submitDogPhoto({ file, dogName, displayName, caption });
      setMessage('Your nap photo was submitted! It will appear publicly after a moderator approves it.');
      setFile(null); setDogName(''); setDisplayName(''); setCaption(''); setConsent(false);
      if (fileRef.current) fileRef.current.value = '';
      setFormOpen(false);
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); }
    finally { setBusy(false); }
  }

  async function download(photo: SdcPhoto) {
    setActionError('');
    try { await downloadApprovedPhoto(photo); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Download failed.'); }
  }

  async function report(photo: SdcPhoto) {
    setActionError(''); setMessage('');
    if (!window.confirm('Report this photo to the moderators for review?')) return;
    try { await reportApprovedPhoto(photo.id); setMessage('Thank you. Your report was submitted for review.'); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Report failed.'); }
  }

  return (
    <section className={styles.gallery} id="sdc-gallery" aria-labelledby="sdc-gallery-title">
      <div className={styles.topline}><span>04 / the nap club</span><span>REAL DOGS · REAL NAPS · ZERO HUSTLE</span></div>
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>WELCOME TO THE INTERNET&apos;S COZIEST CORNER</p>
          <h2 id="sdc-gallery-title">The Sleepy<br/><em>Dogs Club.</em></h2>
          <div className={styles.ticker}>$ZZZPUPS <span>on Ethereum</span></div>
          <p className={styles.intro}>Got a sleeping dog? Post the evidence. Share the cutest, weirdest, and most ridiculous naps with dog lovers everywhere.</p>
          <div className={styles.ctas}>
            <button type="button" className={styles.primary} onClick={() => { setFormOpen(x => !x); setActionError(''); }} aria-expanded={formOpen} aria-controls="sdc-upload-panel">
              {formOpen ? 'Close upload form' : 'Post your sleeping dog'} <span aria-hidden="true">↗</span>
            </button>
            <a href="#sdc-community-grid" className={styles.secondary}>Explore nap photos ↓</a>
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
            <div className={styles.formHeading}><h3>Submit a sleepy pup</h3><p>Sharing is free. You never need to buy a token to post a dog.</p></div>
            {!galleryConfigured ? (
              <div className={styles.notice} role="status"><strong>Photo uploads aren&apos;t live yet.</strong> The site owner needs to connect Supabase Storage and run the included SQL setup. Until then, you can browse and download existing pictures below.</div>
            ) : (
              <form onSubmit={e => { void submit(e); }} className={styles.form}>
                <label className={styles.filePicker}>
                  <span>{file ? file.name : 'Choose a photo of your sleeping dog'}</span><small>JPG, PNG or WebP · source ≤ 12 MB · automatically resized, with camera location metadata stripped</small>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => { setFile(e.target.files?.[0] || null); setActionError(''); }} />
                </label>
                {preview && (
                  <div className={styles.preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview of your selected dog photo" />
                  </div>
                )}
                <div className={styles.twoFields}>
                  <label>Dog&apos;s name <span>*</span><input value={dogName} required maxLength={48} onChange={e => setDogName(e.target.value)} placeholder="e.g. Mochi" /></label>
                  <label>Display name (optional)<input value={displayName} maxLength={40} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Mochi's human" /></label>
                </div>
                <label>Caption (optional)<textarea value={caption} maxLength={220} rows={3} onChange={e => setCaption(e.target.value)} placeholder="Give this ridiculous nap a title…" /></label>
                <label className={styles.consent}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>I own or have permission to submit this photograph. I consent to public display and allow visitors to download and share it. I understand it will be moderated before appearing.</span></label>
                <div className={styles.formBottom}><span>Up to 3 submissions per visitor per day. Moderators approve posts before publication.</span><button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval ↗'}</button></div>
              </form>
            )}
          </div>
        )}
      </div>
      <div className={styles.galleryHead} id="sdc-community-grid"><div><p className={styles.kicker}>THE COMMUNITY NAP GALLERY</p><h3>Sleepy legends<span>.</span></h3></div>{galleryConfigured && <button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh photos</button>}</div>
      {galleryConfigured && loadError && <p className={styles.error} role="alert">Could not load community photos: {loadError}</p>}
      {galleryConfigured && loading && <p className={styles.placeholder} role="status">Collecting the latest naps…</p>}
      {galleryConfigured && !loading && !loadError && photos.length === 0 && (
        <div className={styles.placeholder}><strong>The gallery is dreaming.</strong><p>No approved uploads yet. Post your dog and help us start the club.</p></div>
      )}
      {photos.length > 0 && (
        <div className={styles.photoGrid}>
          {photos.map((photo) => (
            <article key={photo.id} className={styles.photoCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.imageUrl} alt={`${photo.dog_name} sleeping. ${photo.caption}`} loading="lazy" />
              <div className={styles.photoDetails}><strong>{photo.dog_name}</strong><small>by {photo.display_name} · {dateLabel(photo.created_at)}</small>{photo.caption && <p>{photo.caption}</p>}</div>
              <div className={styles.photoActions}><button type="button" onClick={() => void download(photo)} aria-label={`Download photo of ${photo.dog_name}`}>↓ Download</button><button type="button" onClick={() => void report(photo)} aria-label={`Report photo of ${photo.dog_name}`}>Report</button></div>
            </article>
          ))}
        </div>
      )}
      <div className={styles.scrapbookHead}><h3>From our scrapbook</h3><p>Existing site photos · downloadable while the community gallery grows</p></div>
      <div className={styles.scrapbook}>
        {scrapbook.map((photo, i) => (
          <article key={photo.src} className={styles.scrapbookCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(photo.src)} alt={`Sleepy dog scrapbook photo ${i + 1}: ${photo.caption}`} loading="lazy" />
            <div><span>{photo.caption}</span><a href={asset(photo.src)} download={`sleepy-dog-scrapbook-${i + 1}.jpg`} aria-label={`Download scrapbook photo ${i + 1}`}>↓ Download</a></div>
          </article>
        ))}
      </div>
      <div className={styles.lastLine}><span>REAL PUPS, REAL PEOPLE.</span><strong>EVERY NAP DESERVES A POST.</strong><span>EST. NAP O&apos;CLOCK ☾</span></div>
    </section>
  );
}
