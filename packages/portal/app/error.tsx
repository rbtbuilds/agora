"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="text-xs uppercase tracking-widest text-secondary mb-4">
        Something broke
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Unexpected error
      </h1>
      <p className="text-secondary max-w-sm mb-8 leading-relaxed">
        We logged the error and are looking into it. Try the page again, or come back in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-5 py-2.5 bg-accent text-[#0a0a0a] rounded-lg text-sm font-semibold transition-colors hover:brightness-110"
      >
        Try again
      </button>
      {error.digest && (
        <p className="mt-8 font-mono text-xs text-[#52525b]">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
