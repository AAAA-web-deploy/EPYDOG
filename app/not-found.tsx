import Link from "next/link";
export default function NotFound() {
  return <main className="not-found"><h1>eepy got lost.</h1><p>probably took a wrong turn on the way to his nap.</p><Link href="/">take me back</Link></main>;
}
