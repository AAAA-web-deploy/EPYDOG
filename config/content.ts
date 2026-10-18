/** All media and corkboard content live here; update without touching components. */
export type Track = { id: number; name: string; src: string; durationHint?: string };
export const tracks: Track[] = [
  { id: 1, name: "leaves on the path", src: "/audio/01-leaves-on-the-path.mp3" },
  { id: 2, name: "bench for one", src: "/audio/02-bench-for-one.mp3" },
  { id: 3, name: "rainy window", src: "/audio/03-rainy-window.mp3" },
  { id: 4, name: "thinking about her", src: "/audio/04-thinking-about-her.mp3" },
];

export const pictures = [
  { src: "/memes/01.jpg", caption: "morning routine (takes 3 hrs)", alt: "Eepy meme 1" },
  { src: "/memes/02.jpg", caption: "3am. one more video", alt: "Eepy meme 2" },
  { src: "/memes/03.jpg", caption: "on my way to do nothing", alt: "Eepy meme 3" },
  { src: "/memes/04.jpg", caption: "gym day. sat down. done.", alt: "Eepy meme 4" },
  { src: "/memes/05.jpg", caption: "boss calling. absolutely not.", alt: "Eepy meme 5" },
  { src: "/memes/06.jpg", caption: "first period", alt: "Eepy meme 6" },
  { src: "/memes/07.jpg", caption: "charging (both of us)", alt: "Eepy meme 7" },
];

export const media = {
  parkVideo: "/park-loop.mp4",
  parkPoster: "/park-poster.jpg",
  napVideo: "/nap-loop.mp4",
  napPoster: "/nap-poster.jpg",
  portrait: "/who.jpg",
  sky: "/city-tall.jpg",
};
