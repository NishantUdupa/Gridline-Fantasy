import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-16 text-center sm:px-8">
      <div>
        <p className="metric-label">404</p>
        <h1 className="mt-2 font-heading text-5xl font-extrabold uppercase">That page is off the board</h1>
        <p className="mt-4 text-sm text-muted-foreground">The player or page you requested could not be found.</p>
        <Link href="/" className={buttonVariants({ className: "mt-6" })}>Back to Gridline</Link>
      </div>
    </main>
  );
}
