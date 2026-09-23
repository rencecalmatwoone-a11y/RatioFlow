import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f8f8] px-5 text-center text-[#181818]">
      <h1 className="text-2xl font-medium">Page not found.</h1>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-[#1e1e1e] px-6 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Open RatioFlow</Link>
    </main>
  );
}
