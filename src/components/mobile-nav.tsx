"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

const nav = [["Weekly Rankings", "/rankings"], ["Rest of Season", "/rest-of-season"], ["Boom / Bust", "/boom-bust"], ["My Roster", "/roster"], ["Trade Lab", "/trade"], ["Start / Sit", "/start-sit"]];

export function MobileNav() {
  const details = useRef<HTMLDetailsElement>(null);
  const close = () => details.current?.removeAttribute("open");
  return (
    <details ref={details} className="relative md:hidden">
      <summary className="list-none cursor-pointer" aria-label="Open navigation"><Menu /></summary>
      <nav className="absolute right-0 top-9 flex w-48 flex-col rounded-md border border-white/10 bg-[#10241c] p-2 shadow-xl">
        {nav.map(([label, href]) => <Link onClick={close} key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-white/10">{label}</Link>)}
      </nav>
    </details>
  );
}
