'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { asset } from '@/lib/asset';
import {
  downloadApprovedPhoto, downloadMayOpenInstead, downloadScrapbook, galleryConfigured, listApprovedPhotos, reportApprovedPhoto,
  submitDogPhoto, turnstileSiteKey, uploadsReady, type SdcPhoto,
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

function TurnstileBox({ onToken }: { onToken: (token: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widgetId = '';
    let timer = 0;
    let cancelled = false;
    const mount = () => {
      if (cancelled || widgetId || !holder.current || !window.turnstile) return false;
      widgetId = window.turnstile.render(holder.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
      return true;
    };
    if (!mount()) timer = window.setInterval(() => { if (mount()) window.clearInterval(timer); }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);
  return <div ref={holder} className={styles.turnstile} />;
}

/** Additive community section. Does not replace hero, nap video, existing corkboard, or radio. */
export default function SdcCommunityGallery() {
  const [photos, setPhotos] = useState<SdcPhoto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(galleryConfigured);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dogName, setDogName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [caption, setCaption] = useState('');
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [reportId, setReportId] = useState('');
  const [reportReason, setReportReason] = useState('Please remove this photo');
  const [reportToken, setReportToken] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const rememberToken = useCallback((token: string) => setTurnstileToken(token), []);
  const rememberReportToken = useCallback((token: string) => setReportToken(token), []);

  const load = useCallback(async (cursor = '', append = false) => {
    if (!galleryConfigured) return;
    setLoading(true);
    setLoadError('');
    try {
      const page = await listApprovedPhotos(cursor);
      setPhotos((current) => append ? [...current, ...page.photos] : page.photos);
      setNextCursor(page.nextCursor);
    }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load community photos.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!turnstileSiteKey || document.querySelector('script[data-sdc-turnstile]')) return;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.dataset.sdcTurnstile = '1';
    document.head.append(script);
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
    const allowed = ['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || /\.(jpe?g|png|webp)$/i.test(next.name);
    if (!allowed) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setActionError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    setFile(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(''); setMessage('');
    if (!file) { setActionError('Choose a photo first.'); return; }
    if (!consent) { setActionError('Please confirm that you own the photo and permit sharing and downloading.'); return; }
    if (!galleryConfigured) { setActionError('Photo storage is not connected yet. This build has no Cloudflare gallery address, so this photo was not sent.'); return; }
    if (!turnstileSiteKey) { setActionError('Uploads are paused because this build is missing the Cloudflare Turnstile site key. This photo was not sent.'); return; }
    setBusy(true);
    setProgress('Checking the photo…');
    try {
      await submitDogPhoto({ file, dogName, displayName, caption, turnstileToken }, setProgress);
      setMessage('Your sleepy dog has been submitted! Your photo will appear after approval.');
      setProgress('');
      setFile(null); setDogName(''); setDisplayName(''); setCaption(''); setConsent(false); setTurnstileToken('');
      if (fileRef.current) fileRef.current.value = '';
      setFormOpen(false);
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); setProgress(''); }
    finally { setBusy(false); }
  }

  function savedNote(label: string) {
    const extra = downloadMayOpenInstead() ? ' If it opened instead of saving, use your browser’s Save Image or Share control.' : '';
    setMessage(`${label} download started.${extra}`);
  }

  async function download(photo: SdcPhoto) {
    setActionError('');
    try {
      await downloadApprovedPhoto(photo);
      savedNote(`${photo.dogName} photo`);
    }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Download failed.'); }
  }

  async function downloadSample(url: string, filename: string, label: string) {
    setActionError('');
    try {
      await downloadScrapbook(url, filename);
      savedNote(label);
    }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Download failed.'); }
  }

  async function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(''); setMessage('');
    try {
      await reportApprovedPhoto(reportId, reportToken, reportReason);
      setMessage('Thank you. Your removal request was stored for the owner to review.');
      setReportId('');
      setReportToken('');
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Report failed.'); }
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
              {formOpen ? 'Close upload form' : 'Upload Photo'} <span aria-hidden="true">↗</span>
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
            {!uploadsReady && (
              <div className={styles.notice} role="status"><strong>This form can preview a photo, but it cannot store one yet.</strong> {!galleryConfigured ? 'This build has no Cloudflare gallery address.' : 'This build is missing the Cloudflare Turnstile site key.'} Nothing is saved until that connection exists. Scrapbook downloads still work.</div>
            )}
            <form onSubmit={e => { void submit(e); }} className={styles.form}>
                <label
                  className={`${styles.filePicker}${dragging ? ` ${styles.dragging}` : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0] || null); }}
                >
                  <span>{file ? file.name : 'Choose a photo of your sleeping dog'}</span><small>JPG, PNG or WebP · drag a file here or use your camera roll · resized before upload · camera location removed</small>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => chooseFile(e.target.files?.[0] || null)} />
                </label>
                {preview && (
                  <div className={styles.preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview of your selected dog photo" />
                  </div>
                )}
                <div className={styles.twoFields}>
                  <label>Dog&apos;s name <span>*</span><input value={dogName} required maxLength={48} onChange={e => setDogName(e.target.value)} placeholder="e.g. Mochi" /></label>
                  <label>Nickname (optional)<input value={displayName} maxLength={40} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Mochi's human" /></label>
                </div>
                <label>Caption (optional)<textarea value={caption} maxLength={220} rows={3} onChange={e => setCaption(e.target.value)} placeholder="Give this ridiculous nap a title…" /></label>
                <label className={styles.consent}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>I own or have permission to submit this photograph. I consent to public display and allow visitors to download and share it. I understand it will be moderated before appearing.</span></label>
                {turnstileSiteKey && <TurnstileBox onToken={rememberToken} />}
                {busy && <p className={styles.progress} role="status"><progress max={100} value={Number(progress.match(/(\d+)/)?.[1] || 0)} /> {progress || 'Submitting…'}</p>}
                <div className={styles.formBottom}><span>Up to 3 submissions per visitor per day. The owner approves posts before publication. No wallet or token is required.</span><button type="submit" disabled={busy}>{busy ? (progress || 'Submitting…') : 'Submit for approval ↗'}</button></div>
              </form>
          </div>
        )}
      </div>
      <div className={styles.galleryHead} id="sdc-community-grid"><div><p className={styles.kicker}>THE COMMUNITY NAP GALLERY</p><h3>Sleepy legends<span>.</span></h3></div>{galleryConfigured && <button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh photos</button>}</div>
      {galleryConfigured && loadError && <p className={styles.error} role="alert">Could not load community photos: {loadError}</p>}
      {galleryConfigured && loading && <p className={styles.placeholder} role="status">Collecting the latest naps…</p>}
      {galleryConfigured && !loading && !loadError && photos.length === 0 && (
        <div className={styles.placeholder}><strong>The gallery is dreaming.</strong><p>No approved member photos yet. A submission stays private until the owner approves it.</p></div>
      )}
      {!galleryConfigured && (
        <div className={styles.placeholder}><strong>Member photos are not connected yet.</strong><p>The pictures below are the original scrapbook, not photos uploaded by club members.</p></div>
      )}
      {photos.length > 0 && (
        <div className={styles.photoGrid}>
          {photos.map((photo) => (
            <article key={photo.id} className={styles.photoCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.imageUrl} alt={`${photo.dogName} sleeping. ${photo.caption}`} loading="lazy" />
              <div className={styles.photoDetails}><strong>{photo.dogName}</strong><small>by {photo.displayName} · {dateLabel(photo.createdAt)}</small>{photo.caption && <p>{photo.caption}</p>}</div>
              <div className={styles.photoActions}><button type="button" onClick={() => void download(photo)} aria-label={`Download photo of ${photo.dogName}`}>↓ Download</button><button type="button" onClick={() => { setReportId(photo.id); setReportReason('Please remove this photo'); setActionError(''); }} aria-label={`Report photo of ${photo.dogName}`}>Report</button></div>
              {reportId === photo.id && (
                <form className={styles.reportForm} onSubmit={e => { void sendReport(e); }}>
                  <label>Why should this come down?<textarea value={reportReason} maxLength={140} rows={2} onChange={e => setReportReason(e.target.value)} /></label>
                  {turnstileSiteKey ? <TurnstileBox onToken={rememberReportToken} /> : <p>Reports need the human check to be configured.</p>}
                  <button type="submit">Send removal request</button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
      {nextCursor && <p className={styles.more}><button type="button" onClick={() => void load(nextCursor, true)} disabled={loading}>Load more naps</button></p>}
      <div className={styles.scrapbookHead}><h3>From our scrapbook</h3><p>Existing site photos · downloadable while the community gallery grows</p></div>
      <div className={styles.scrapbook}>
        {scrapbook.map((photo, i) => (
          <article key={photo.src} className={styles.scrapbookCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(photo.src)} alt={`Sleepy dog scrapbook photo ${i + 1}: ${photo.caption}`} loading="lazy" />
            <div><span>{photo.caption}</span><button type="button" onClick={() => void downloadSample(asset(photo.src), `sleepy-dog-scrapbook-${i + 1}.jpg`, photo.caption)} aria-label={`Download scrapbook photo ${i + 1}`}>↓ Download</button></div>
          </article>
        ))}
      </div>
      <div className={styles.lastLine}><span>REAL PUPS, REAL PEOPLE.</span><strong>EVERY NAP DESERVES A POST.</strong><span>EST. NAP O&apos;CLOCK ☾</span></div>
    </section>
  );
}
