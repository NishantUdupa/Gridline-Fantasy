const modelPoints = [
  ["01", "The blend with the smaller miss", "Each position tests mixes of season scoring, recent form, opportunity, efficiency, and trajectory on completed weeks from this season and last. The published number is the mix with the lowest error. A Sleeper prior is included only at the weight that improved that test."],
  ["02", "Usage has to earn the change", "Target share, yards per target, and the other usage terms move a projection only when adding them reduced error in the backtest. Matchup is scaled by how much of that player's opportunity they actually used."],
  ["03", "A range from that player", "Floor and ceiling sit at least 2.2 points either side of the projection, wider when that player's own week-to-week spread is larger. It is that player's volatility, not a flat buffer applied to everyone."],
  ["04", "Injury news is priced in", "Questionable, doubtful, and out tags scale the weekly projection directly. The rest-of-season board estimates games missed and the workload on return from the injury type, so a recovery shows up in the number rather than a footnote."],
] as const;

const rangeSections = [
  { value: "15%", label: "Below our floor", className: "bg-[#8d4a3b] text-white" },
  { value: "61%", label: "Inside our range", className: "text-white", striped: true },
  { value: "24%", label: "Above the ceiling", className: "bg-[#d7ff52] text-[#102c21]" },
] as const;

const bustCalls = [
  ["Bijan Robinson", -19],
  ["Kyren Williams", -16.3],
  ["Jaylen Warren", -14.5],
  ["Juwan Johnson", -13.6],
  ["Brock Bowers", -12.7],
  ["Darren Waller", -11.7],
  ["Harold Fannin", -10.5],
  ["Aaron Rodgers", -6.2],
  ["Travis Kelce", -4.9],
  ["Trey McBride", -3.8],
  ["Geno Smith", -1.9],
  ["Jaxon Smith-Njigba", 1.8],
  ["Kenneth Walker", 2.6],
  ["Stefon Diggs", 3.9],
  ["Christian McCaffrey", 12.4],
] as const;

const bustScale = 20;
const lean = "polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%)";

export function HomeAccuracy() {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
          <div>
            <p className="metric-label">What you get</p>
            <h2 className="mt-3 max-w-xl font-heading text-4xl font-bold uppercase leading-[.92] sm:text-5xl">
              Closer on the players who fill a lineup.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              In week 6, Gridline and Sleeper were each closer to the actual score for 169 of the 339 players both models projected. Gridline&apos;s miss was smaller at wide receiver, tight end, and defense, and more of its projections landed inside three points.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-y-1">
            <div className="bg-[#f7f8f4] px-7 py-5 transition-transform duration-200 hover:-translate-y-1 sm:px-9" style={{ clipPath: lean }}>
              <p className="font-heading text-3xl font-bold leading-none tracking-tight sm:text-4xl">169–169–1</p>
              <p className="metric-label mt-3">Head-to-head with Sleeper</p>
            </div>
            <div className="-ml-3.5 bg-[#f7f8f4] px-7 py-5 transition-transform duration-200 hover:-translate-y-1 sm:px-9" style={{ clipPath: lean }}>
              <p className="flex items-baseline gap-1.5 font-heading font-bold leading-none tracking-tight">
                <span className="text-4xl text-black">49%</span>
                <span className="text-2xl text-[#8a938c]">&gt;</span>
                <span className="text-2xl text-[#8a938c]">45%</span>
              </p>
              <p className="metric-label mt-3">Inside 3 points vs Sleeper</p>
            </div>
            <div className="bg-[#f7f8f4] px-7 py-5 transition-transform duration-200 hover:-translate-y-1 sm:px-9" style={{ clipPath: lean }}>
              <p className="font-heading text-4xl font-bold leading-none tracking-tight">WR · TE · DEF</p>
              <p className="metric-label mt-3">Better projections than Sleeper</p>
            </div>
            <div className="-ml-3.5 bg-[#f7f8f4] px-7 py-5 transition-transform duration-200 hover:-translate-y-1 sm:px-9" style={{ clipPath: lean }}>
              <p className="font-heading text-4xl font-bold leading-none tracking-tight">11 / 15</p>
              <p className="metric-label mt-3">Busts finished under recent form</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden border bg-border lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <div className="grid gap-px bg-border">
            <div className="bg-white p-6 sm:p-7">
              <p className="metric-label">Projection range · 350 players who played</p>
              <h3 className="mt-2 font-heading text-2xl font-bold uppercase">Where the actual score landed</h3>
              <div
                className="mt-6 flex h-36 items-end"
                role="img"
                aria-label="15 percent below our floor, 61 percent inside our range, 24 percent above the ceiling"
              >
                {rangeSections.map((section, index) => (
                  <div
                    key={section.label}
                    className={`flex h-24 min-w-0 flex-1 flex-col items-center justify-center px-6 transition-[height] duration-200 ease-out hover:h-36 ${index > 0 ? "-ml-4" : ""} ${section.className}`}
                    style={{
                      clipPath: "polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%)",
                      ...("striped" in section
                        ? { backgroundColor: "#1d6a49", backgroundImage: "repeating-linear-gradient(-16deg, transparent, transparent 9px, rgba(215,255,82,.16) 9px, rgba(215,255,82,.16) 10px)" }
                        : {}),
                    }}
                  >
                    <span className="font-heading text-3xl font-bold leading-none sm:text-4xl">{section.value}</span>
                    <span className="mt-1.5 text-center text-[10px] font-bold uppercase leading-tight tracking-[.12em] opacity-80">{section.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">The average published band was 8.5 points wide. Sleeper&apos;s weekly board is a single number. FantasyPros orders expert opinion. Neither shows a range built from the player&apos;s own scoring spread.</p>
            </div>

            <div className="bg-white p-6 sm:p-7">
              <p className="metric-label">15 bust calls · points versus recent form</p>
              <h3 className="mt-2 font-heading text-2xl font-bold uppercase">11 busts came in under recent form</h3>
              <div className="mt-5 space-y-1.5">
                {bustCalls.map(([name, delta]) => {
                  const under = delta < 0;
                  return (
                    <div key={name} className="group grid grid-cols-[minmax(0,8.5rem)_1fr_3rem] items-center gap-2">
                      <span className="truncate text-xs font-medium">{name}</span>
                      <div className="relative h-4 transition-[height] duration-200 group-hover:h-6">
                        <div className="absolute inset-y-1 left-0 right-0 bg-[#eef2ea]" />
                        <div className="absolute inset-y-1 left-1/2 w-px bg-[#c5cdc4]" />
                        <div
                          className={`absolute top-1/2 h-2 -translate-y-1/2 transition-all duration-200 group-hover:h-5 ${under ? "bg-[#1d6a49]" : "bg-[#8d4a3b]"}`}
                          style={under
                            ? { right: "50%", width: `${(Math.abs(delta) / bustScale) * 50}%` }
                            : { left: "50%", width: `${(delta / bustScale) * 50}%` }}
                        />
                      </div>
                      <span className={`text-right text-xs font-semibold tabular-nums ${under ? "text-[#1d6a49]" : "text-[#8d4a3b]"}`}>
                        {under ? delta.toFixed(1) : `+${delta.toFixed(1)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Left of center finished under recent form, which is the bust the board called. Four calls went the other way: Smith-Njigba, Walker, Diggs, and McCaffrey.
              </p>
            </div>
          </div>

          <div className="bg-[#102c21] p-6 text-white sm:p-7">
            <p className="metric-label !text-white/40">The model</p>
            <h3 className="mt-2 font-heading text-3xl font-bold uppercase leading-none">Checked before it is published.</h3>
            <ol className="mt-6 space-y-5">
              {modelPoints.map(([index, title, copy]) => (
                <li key={index}>
                  <p className="font-heading text-sm font-bold tracking-[.16em] text-[#d7ff52]">{index}</p>
                  <p className="mt-1 font-heading text-xl font-bold uppercase leading-tight">{title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-white/65">{copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
