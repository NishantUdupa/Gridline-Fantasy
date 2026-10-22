"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Gridline route error", error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-16 text-center sm:px-8">
      <div>
        <p className="metric-label">Live data unavailable</p>
        <h1 className="mt-2 font-heading text-5xl font-extrabold uppercase">The model board could not load</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          Sleeper may be temporarily unavailable. Gridline never substitutes fictional player data, so try the live feed again shortly.
        </p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
