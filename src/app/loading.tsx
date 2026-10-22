export default function Loading() {
  return (
    <main className="mx-auto grid min-h-[65vh] max-w-3xl place-items-center px-5 py-16 text-center sm:px-8">
      <div>
        <p className="metric-label">Updating live data</p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold uppercase">Building the model board…</h1>
        <p className="mt-3 text-sm text-muted-foreground">Loading current Sleeper data and matchup context.</p>
      </div>
    </main>
  );
}
