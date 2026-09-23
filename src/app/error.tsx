"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f8f8] px-5 text-center text-[#181818]">
      <h1 className="text-2xl font-medium">Something went wrong.</h1>
      <p className="max-w-sm text-sm text-[#62625e]">Your image has not been uploaded anywhere. Try reloading RatioFlow.</p>
      <button type="button" onClick={reset} className="min-h-11 rounded-full bg-[#1e1e1e] px-6 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">
        Try again
      </button>
    </main>
  );
}
