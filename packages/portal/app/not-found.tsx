import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="font-mono text-xs uppercase tracking-widest text-secondary mb-4">
        404
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Page not found
      </h1>
      <p className="text-secondary max-w-sm mb-8 leading-relaxed">
        The page you&apos;re looking for has moved or doesn&apos;t exist.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-accent text-[#0a0a0a] rounded-lg text-sm font-semibold transition-colors hover:brightness-110"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
