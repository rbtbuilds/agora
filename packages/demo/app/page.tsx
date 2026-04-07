import { Tabs } from "./components/tabs";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold bg-gradient-to-r from-white via-accent to-indigo-500 bg-clip-text text-transparent">
            Agora
          </h1>
          <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent-border">
            Demo
          </span>
        </div>
        <a
          href="https://github.com/rbtbuilds/agora"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-secondary hover:text-[#e5e5e5] transition-colors"
        >
          GitHub →
        </a>
      </header>

      {/* Tabs + Content */}
      <Tabs />
    </div>
  );
}
