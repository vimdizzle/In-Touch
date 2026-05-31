"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user already consented
    const consent = localStorage.getItem("in-touch-cookie-consent");
    if (!consent) {
      // Show banner after 1.5s delay for premium transition
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("in-touch-cookie-consent", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-45 select-none pointer-events-none">
      <div className="w-full max-w-sm animate-slideUp pointer-events-auto">
        <div className="bg-[#0b1120]/95 border border-gray-800/85 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5">
          <div className="flex-1">
            <p className="text-xs text-gray-400 leading-relaxed text-center sm:text-left">
              We use secure local session tokens to keep you signed in. By continuing, you agree to our{" "}
              <Link 
                href="/privacy" 
                className="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <div className="flex justify-center sm:justify-end gap-2 shrink-0">
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-[#111827] hover:bg-[#1f2937] text-white border border-gray-700 hover:border-gray-600 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
            >
              Read Policy
            </button>
            <Link href="/privacy" className="hidden" /> {/* prefetch helper */}
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white text-xs font-bold rounded-full transition-all duration-200 cursor-pointer shadow-md shadow-cyan-950/20 active:scale-95 shrink-0 font-sans"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
