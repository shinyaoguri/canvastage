import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold text-white">Canvastage</h1>
      <p className="text-zinc-400">p5.js Live Coding / VJ Tool</p>
      <div className="flex gap-4">
        <Link
          href="/control"
          className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Control
        </Link>
        <Link
          href="/stage"
          className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Stage
        </Link>
      </div>
    </main>
  );
}
