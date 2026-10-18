import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = join(process.cwd(), 'public');
const expected = [
  'park-loop.mp4','nap-loop.mp4','park-poster.jpg','nap-poster.jpg',
  'city-tall.jpg','cement.png','who.jpg','favicon.ico',
  ...Array.from({ length: 7 }, (_, i) => `memes/${String(i + 1).padStart(2,'0')}.jpg`),
  'brand/replace-with-your-logo.svg',
  'audio/01-leaves-on-the-path.mp3','audio/02-bench-for-one.mp3',
  'audio/03-rainy-window.mp3','audio/04-thinking-about-her.mp3'
];
let failed = false;
for (const path of expected) {
  const full = join(root, path);
  const okay = existsSync(full) && statSync(full).size > 0;
  console.log(`${okay ? 'OK' : 'MISSING'}  public/${path}`);
  if(!okay) failed = true;
}
console.log(`\n${expected.length} files checked. ${failed ? 'Some required assets are missing.' : 'Asset inventory complete.'}`);
if(failed) process.exit(1);
