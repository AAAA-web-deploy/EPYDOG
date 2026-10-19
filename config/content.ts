/** All media and corkboard content live here; update without touching components. */
export type Track = { id: number; name: string; src: string; durationHint?: string };
export const tracks: Track[] = [
  { id: 1, name: "leaves on the path", src: "/audio/01-leaves-on-the-path.mp3" },
  { id: 2, name: "bench for one", src: "/audio/02-bench-for-one.mp3" },
  { id: 3, name: "rainy window", src: "/audio/03-rainy-window.mp3" },
  { id: 4, name: "thinking about her", src: "/audio/04-thinking-about-her.mp3" },
];

export const pictures = [
  { src: "/memes/01.jpg", caption: "morning routine (takes 3 hrs)", alt: "Sample gallery photo, not a club submission: morning routine" },
  { src: "/memes/02.jpg", caption: "3am. one more video", alt: "Sample gallery photo, not a club submission: late-night screen" },
  { src: "/memes/03.jpg", caption: "on my way to do nothing", alt: "Sample gallery photo, not a club submission: heading out" },
  { src: "/memes/04.jpg", caption: "gym day. sat down. done.", alt: "Sample gallery photo, not a club submission: gym day" },
  { src: "/memes/05.jpg", caption: "boss calling. absolutely not.", alt: "Sample gallery photo, not a club submission: ignoring a call" },
  { src: "/memes/06.jpg", caption: "first period", alt: "Sample gallery photo, not a club submission: first period" },
  { src: "/memes/07.jpg", caption: "charging (both of us)", alt: "Sample gallery photo, not a club submission: charging" },
];

export const media = {
  parkVideo: "/park-loop.mp4",
  parkPoster: "/park-poster.jpg",
  napVideo: "/nap-loop.mp4",
  napPoster: "/nap-poster.jpg",
  portrait: "/who.jpg",
  sky: "/city-tall.jpg",
};
