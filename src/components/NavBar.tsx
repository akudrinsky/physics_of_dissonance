import Link from "next/link";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          physics.dissonance
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/visualizations/dyadic-explorer" className="hover:underline underline-offset-4">
            Dyadic explorer
          </Link>
          <Link href="/visualizations/triad-explorer" className="hover:underline underline-offset-4">
            Triad explorer
          </Link>
          <Link href="/theory" className="hover:underline underline-offset-4">
            Theory notes
          </Link>
        </nav>
      </div>
    </header>
  );
}
