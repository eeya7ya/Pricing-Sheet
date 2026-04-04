"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, GitCompare, Home, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/request-access", label: "Request Access", icon: UserPlus },
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/compare", label: "Compare", icon: GitCompare },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 ring-1 ring-cyan-200 group-hover:bg-cyan-100 transition-colors">
            <Calculator className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">
            Smart Pricing Sheet
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            const isRequestAccess = href === "/request-access";
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isRequestAccess && !isActive
                    ? "text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700"
                    : isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
