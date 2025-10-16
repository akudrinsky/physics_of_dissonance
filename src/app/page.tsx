import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Physics of Dissonance</h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Interactive visualizations and audio demos exploring roughness, consonance, and tuning.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/visualizations/dyadic-explorer" className="px-4 py-2 rounded-md bg-white text-black font-medium">
            Explore dyadic explorer
          </Link>
          <Link href="/theory" className="px-4 py-2 rounded-md border border-white/20">
            Theory notes
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-6">
        <Link
          href="/visualizations/dyadic-explorer"
          className="rounded-lg border border-white/10 p-6 bg-gradient-to-br from-slate-900/80 to-sky-900/20 hover:border-white/20 transition"
        >
          <h3 className="font-semibold mb-2 text-white">Dyadic explorer</h3>
          <p className="text-sm text-gray-300">
            Sweep two-note ratios, inspect harmonic partials, and hear how timbre reshapes consonance valleys.
          </p>
        </Link>
        <Link
          href="/visualizations/triad-explorer"
          className="rounded-lg border border-white/10 p-6 bg-gradient-to-br from-slate-900/80 to-amber-900/20 hover:border-white/20 transition"
        >
          <h3 className="font-semibold mb-2 text-white">Triad explorer</h3>
          <p className="text-sm text-gray-300">
            Navigate a 3D consonance surface for three-note chords, spot minima, and audition the richest triads.
          </p>
        </Link>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6 space-y-3">
        <h2 className="text-xl font-semibold text-white">References &amp; inspiration</h2>
        <p className="text-sm text-gray-300">
          These explorations build on the lineage of research and storytelling below:
        </p>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>
            <a
              href="https://www.youtube.com/watch?v=tCsl6ZcY9ag"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              minutephysics: The Physics Of Dissonance
            </a>
          </li>
          <li>
            <a
              href="https://aatishb.com/dissonance/"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Aatish Bhatia: Dissonance, A Journey Through Musical Possibility Space
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
