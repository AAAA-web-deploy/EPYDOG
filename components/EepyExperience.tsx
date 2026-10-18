"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { contractDisplay, hasValidContract, site, swapLink, tokenLink } from "@/config/site";
import { media, pictures, tracks } from "@/config/content";
import { asset } from "@/lib/asset";
import Analytics from "./Analytics";

const DOTS = 22;

function Leaves() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = ["#c47a3a", "#d4a24a", "#8a4b2f", "#e0c07a", "#6d8a45"];
    const leaves = Array.from({ length: 16 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 5 + Math.random() * 8,
      speed: 0.00012 + Math.random() * 0.00028,
      spin: (Math.random() - 0.5) * 0.02,
      angle: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frame = 0;
    const draw = () => {
      const width = (canvas.width = window.innerWidth);
      const height = (canvas.height = window.innerHeight);
      context.clearRect(0, 0, width, height);
      for (const leaf of leaves) {
        if (!reduce) {
          leaf.y += leaf.speed;
          leaf.angle += leaf.spin;
          leaf.x += Math.sin(leaf.angle) * 0.00035;
          if (leaf.y > 1.08) {
            leaf.y = -0.06;
            leaf.x = Math.random();
          }
        }
        context.save();
        context.translate(leaf.x * width, leaf.y * height);
        context.rotate(leaf.angle);
        context.fillStyle = leaf.color;
        context.globalAlpha = 0.72;
        context.beginPath();
        context.ellipse(0, 0, leaf.size, leaf.size * 0.55, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <canvas id="leaves" ref={ref} aria-hidden="true" />;
}

function EnterGate({ onEnter }: { onEnter: () => void }) {
  const [progress, setProgress] = useState(8);
  const ready = progress >= 100;
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const next = frame > 26 ? 100 : Math.min(99, Math.round(100 * (1 - Math.exp(-frame / 8))));
      setProgress(next);
      if (next >= 100) window.clearInterval(id);
    }, 90);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (ready) buttonRef.current?.focus();
  }, [ready]);
  return (
    <div className={`intro${ready ? " ready" : ""}`} role="dialog" aria-modal="true" aria-labelledby="entry-title">
      <div className="intro__box brick">
        <div className="intro__screen">
          <div className="intro__name" id="entry-title">eepy</div>
          <div className="dots" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`Loading ${progress}%`}>
            {Array.from({ length: DOTS }, (_, index) => (
              <i key={index} className={index / DOTS < progress / 100 ? "lit" : ""} />
            ))}
          </div>
          <div className="intro__msg">loading...</div>
          <button ref={buttonRef} className="enter" type="button" data-link-role="enter" onClick={onEnter}>click to enter</button>
        </div>
      </div>
    </div>
  );
}

export default function EepyExperience() {
  const [entered, setEntered] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [songsOpen, setSongsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [asleepFor, setAsleepFor] = useState(4 * 3600 + 12 * 60);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const track = tracks[trackIndex];

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("locked", !entered);
    return () => document.body.classList.remove("locked");
  }, [entered]);

  useEffect(() => {
    const timer = window.setInterval(() => setAsleepFor((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("eepy-fm-volume");
    if (saved !== null && Number.isFinite(Number(saved))) setVolume(Math.min(1, Math.max(0, Number(saved))));
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (photoIndex === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhotoIndex(null);
      if (event.key === "ArrowRight") setPhotoIndex((index) => ((index ?? 0) + 1) % pictures.length);
      if (event.key === "ArrowLeft") setPhotoIndex((index) => ((index ?? 0) - 1 + pictures.length) % pictures.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [photoIndex]);

  useEffect(() => {
    if (!songsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSongsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [songsOpen]);

  const playTrack = useCallback(async (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (index !== trackIndex) {
      audio.src = asset(tracks[index].src);
      audio.load();
    }
    setTrackIndex(index);
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [trackIndex]);

  const enter = () => {
    setEntered(true);
    void playTrack(trackIndex);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const setVol = (value: number) => {
    const next = Math.min(1, Math.max(0, value));
    setVolume(next);
    window.localStorage.setItem("eepy-fm-volume", String(next));
  };

  const copyContract = async () => {
    if (!hasValidContract) {
      showToast("ethereum CA not configured yet");
      setCopied(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(site.contractAddress);
      setCopied(true);
      showToast("ethereum CA copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("could not copy the contract address");
    }
  };

  const openExternal = (url: string | null, pending: string) => {
    if (!url) {
      showToast(pending);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const hours = Math.floor(asleepFor / 3600);
  const minutes = Math.floor((asleepFor % 3600) / 60);
  const volumeClass = volume === 0 ? "quiet" : volume < 0.4 ? "low" : "";
  const picture = photoIndex === null ? null : pictures[photoIndex];

  return (
    <>
      <Analytics />
      <div className="city" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(media.sky)} alt="" />
      </div>
      <Leaves />
      <header className="hero" id="hero" data-section="hero">
        <nav className="corner" aria-label="Eepy links">
          <button className="plank slat" type="button" data-link-role="x" onClick={() => openExternal(site.xUrl, "x link coming soon")}>x</button>
          <button className="plank slat" type="button" data-link-role="community" onClick={() => openExternal(site.communityUrl, "community link coming soon")}>community</button>
          <button className={`plank slat cabtn${copied ? " done" : ""}`} type="button" data-link-role="copy" onClick={() => void copyContract()} title={hasValidContract ? "Copy contract address" : "Add your Ethereum contract address in config/site.ts"} aria-label="Copy contract address">
            <b>CA</b>
            <span className="cabtn__val">{contractDisplay}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {copied ? <path d="m5 12 5 5L20 7" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>}
            </svg>
          </button>
        </nav>
        <div className="frame brick">
          <div className="stage">
            <video autoPlay muted loop playsInline preload="metadata" poster={asset(media.parkPoster)} aria-label="Eepy, a chubby golden puppy in a puffy black jacket and earbuds, dozing on a park bench by the river">
              <source src={asset(media.parkVideo)} type="video/mp4" />
            </video>
          </div>
        </div>
        <button className="hint" type="button" onClick={() => document.getElementById("notebook")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>scroll down ↓</button>
      </header>
      <main>
        <section className="scene gut" id="notebook" data-section="notebook" aria-labelledby="who-h">
          <span className="label slat">his notebook</span>
          <div className="notebook">
            <div className="nb">
              <div>
                <h2 id="who-h">{site.story.title}</h2>
                {site.story.paragraphs.map((line) => <p key={line}>{line}</p>)}
                <ul>
                  {site.story.facts.map(([label, text]) => <li key={label}>{label}: {text}</li>)}
                  <li>plans for today: <s>stuff</s> nap</li>
                </ul>
              </div>
              <figure className="polaroid">
                <span className="tape" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(media.portrait)} alt="Eepy in his puffy jacket on a mountaintop, eyes closed" />
                <figcaption>me on a hike (once)</figcaption>
              </figure>
            </div>
          </div>
        </section>
        <section className="scene napspot gut" id="nap" data-section="nap" aria-label="Eepy sleeping">
          <span className="label slat">his nap spot</span>
          <div className="napframe brick">
            <div className="stage2">
              <video autoPlay muted loop playsInline preload="metadata" poster={asset(media.napPoster)} aria-label="Eepy asleep on his couch hugging his duck">
                <source src={asset(media.napVideo)} type="video/mp4" />
              </video>
              <div className="zzz" aria-hidden="true"><b>z</b><b>z</b><b>Z</b></div>
            </div>
          </div>
          <div className="sticky">eepy is currently sleeping...<small>asleep for <span>{hours}h {minutes}m</span>. pls do not wake.</small></div>
        </section>
        <section className="scene gut" id="corkboard" data-section="corkboard" aria-label="his corkboard">
          <span className="label slat">his corkboard</span>
          <div className="board brick">
            <div className="cork">
              <div className="pins">
                {pictures.map((item, index) => (
                  <button className="pic" type="button" key={item.src} onClick={() => setPhotoIndex(index)} aria-label={`Open picture ${index + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset(item.src)} alt={item.alt} />
                    <span>{item.caption}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="foot gut" id="footer" data-section="footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="foot-brand" src={asset(site.logo)} alt="Eepy Dog logo" width="46" height="46" />
        <div className="links">
          <button className="plank slat" type="button" data-link-role="x" onClick={() => openExternal(site.xUrl, "x link coming soon")}>x</button>
          <button className="plank slat" type="button" data-link-role="community" onClick={() => openExternal(site.communityUrl, "community link coming soon")}>community</button>
          <button className="plank slat" type="button" data-link-role="uniswap" onClick={() => openExternal(swapLink, "uniswap link appears when the ethereum CA is set")}>uniswap</button>
          <button className="plank slat" type="button" data-link-role="etherscan" onClick={() => openExternal(tokenLink, "etherscan link appears when the ethereum CA is set")}>etherscan</button>
        </div>
        <p>{site.quietLine}</p>
        <p>{site.memeNote}</p>
        <p>{site.footerNote}</p>
      </footer>
      <div className={`radio slat${playing ? " on" : ""} ${volumeClass}`} role="region" aria-label="Eepy FM music player">
        <button className="radio__screen" type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          <span className={playing ? "scroll" : ""}>♪ {String(track.id).padStart(2, "0")} {track.name}</span>
        </button>
        <button className="plank radio__btn" type="button" aria-haspopup="true" aria-expanded={songsOpen} aria-controls="tracks" aria-label="Songs" title="Songs" onClick={() => setSongsOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        </button>
        <button className="radio__speaker" type="button" aria-label={volume === 0 ? "Unmute" : "Mute"} onClick={() => setVol(volume === 0 ? 1 : 0)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
            <path className="w1" d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <path className="w2" d="M18.3 6.6a7.6 7.6 0 0 1 0 10.8" />
            <path className="mute" d="M16 9.5l5 5M21 9.5l-5 5" />
          </svg>
        </button>
        <input className="radio__vol" type="range" min={0} max={1} step={0.01} value={volume} aria-label="Music volume" onChange={(event) => setVol(Number(event.target.value))} />
      </div>
      {songsOpen && (
        <div className="tracks slat" id="tracks" role="dialog" aria-label="Choose a song">
          <p>eepy fm · pick a song</p>
          {tracks.map((item, index) => (
            <button key={item.id} type="button" data-link-role="song" aria-current={index === trackIndex ? "true" : undefined} onClick={() => { void playTrack(index); setSongsOpen(false); }}>
              <b>{String(item.id).padStart(2, "0")}</b>
              <span>{item.name}</span>
            </button>
          ))}
          <p className="demo-note">demonstration audio. not the original eepy fm recordings.</p>
        </div>
      )}
      <audio ref={audioRef} src={asset(track.src)} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => void playTrack((trackIndex + 1) % tracks.length)} />
      {picture && (
        <div className="viewer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoIndex(null); }}>
          <div role="dialog" aria-modal="true" aria-label={picture.caption}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(picture.src)} alt={picture.caption} />
          </div>
          <div className="viewer__bar">
            <button className="plank slat" type="button" onClick={() => setPhotoIndex((index) => ((index ?? 0) - 1 + pictures.length) % pictures.length)}>previous</button>
            <button className="plank slat" type="button" onClick={() => setPhotoIndex(null)}>close</button>
            <button className="plank slat" type="button" onClick={() => setPhotoIndex((index) => ((index ?? 0) + 1) % pictures.length)}>next</button>
            <a className="plank slat" href={asset(picture.src)} target="_blank" rel="noopener noreferrer">open original</a>
          </div>
        </div>
      )}
      <div className={`toast${toast ? " show" : ""}`} role="status">{toast}</div>
      {!entered && <EnterGate onEnter={enter} />}
    </>
  );
}
