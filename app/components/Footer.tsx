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
        <div className="flex items-center justify-center">
          <Link
            href="/feedback"
            className="text-gray-400 hover:text-white transition-colors text-sm underline"
          >
            Feedback
          </Link>
        </div>
      </div>
    </footer>
  );
}

