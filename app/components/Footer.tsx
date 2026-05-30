"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Footer() {
  const pathname = usePathname();
  
  // Hide footer on auth page
  if (pathname === "/auth") {
    return null;
  }

  return (
    <footer className="bg-[#020617] border-t border-gray-800 mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
          <Link
            href="/feedback"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Feedback
          </Link>
          <span className="text-gray-700 select-none hidden sm:inline">•</span>
          <Link
            href="/terms"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Terms & Conditions
          </Link>
          <span className="text-gray-700 select-none hidden sm:inline">•</span>
          <Link
            href="/privacy"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}

