"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Vocabulary" },
  { href: "/minimal-pairs", label: "Minimal Pairs" },
  { href: "/settings", label: "Settings" },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <div className="w-full bg-white border-b">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center py-3 text-sm font-semibold transition ${
                active
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
