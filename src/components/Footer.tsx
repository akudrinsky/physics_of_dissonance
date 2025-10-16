export default function Footer() {
  return (
    <footer className="border-t border-black/10 mt-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between text-sm text-gray-400">
        <p>© {new Date().getFullYear()} Physics of Dissonance</p>
        <p className="hidden sm:block">Built with Next.js + Tailwind</p>
      </div>
    </footer>
  );
}


