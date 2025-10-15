import Link from "next/link";

export default function VisualizationsIndex() {
  const items = [
    {
      href: "/visualizations/dyadic-explorer",
      title: "Dyadic explorer",
      desc: "Two-note consonance valleys, harmonic spectra, and partial breakdowns.",
      accent: "from-sky-500/20 to-sky-400/10",
    },
    {
      href: "/visualizations/triad-explorer",
      title: "Triad explorer",
      desc: "3D consonance surface for three-note chords with harmonic partials.",
      accent: "from-amber-500/20 to-orange-500/10",
    },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">All Visualizations</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`block rounded-xl border border-white/10 p-5 bg-gradient-to-br ${it.accent} hover:border-white/20 transition-all`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">{it.title}</div>
              <span className="text-xs uppercase tracking-widest text-white/60">Explore</span>
            </div>
            <div className="mt-2 text-sm text-gray-300 leading-snug">{it.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

