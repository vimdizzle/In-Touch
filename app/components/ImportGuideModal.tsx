"use client";

import { useState } from "react";

interface ImportGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportGuideModal({ isOpen, onClose }: ImportGuideModalProps) {
  const [tab, setTab] = useState<"google" | "android" | "ios">("google");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-lg w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Export Contacts Guide
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white border border-gray-800 rounded-full hover:bg-[#111827] cursor-pointer"
            title="Close Guide"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-3 bg-[#0d1527] border-b border-gray-850/60 shrink-0">
          <div className="flex bg-[#111827] p-1 rounded-xl w-full">
            <button
              onClick={() => setTab("google")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === "google"
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Google
            </button>
            <button
              onClick={() => setTab("android")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === "android"
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Android
            </button>
            <button
              onClick={() => setTab("ios")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === "ios"
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              iPhone (iOS)
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === "google" && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-gray-400 leading-relaxed">
                Follow these simple steps to export your Google Contacts as a <strong>.vcf (vCard)</strong> file on your computer or mobile browser:
              </p>
              <ol className="space-y-3.5 text-xs text-gray-300">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">1</span>
                  <span>Navigate to <a href="https://contacts.google.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-semibold">Google Contacts</a>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">2</span>
                  <span>Hover over the contacts you want to export and select them via their checkboxes, or to select all, click the checkbox at the top-left menu.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">3</span>
                  <span>Click the <strong className="text-white">Export</strong> button in the left sidebar or the top options action bar.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">4</span>
                  <span>In the pop-up, choose the <strong className="text-white">vCard (for iOS Contacts)</strong> format. Do NOT choose Google CSV.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">5</span>
                  <span>Click <strong className="text-white">Export</strong> and save the file to upload it here.</span>
                </li>
              </ol>
            </div>
          )}

          {tab === "android" && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-gray-400 leading-relaxed">
                Follow these steps to export contacts from your Android device directly as a <strong>.vcf</strong> file:
              </p>
              <ol className="space-y-3.5 text-xs text-gray-300">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">1</span>
                  <span>Open the default <strong className="text-white">Contacts</strong> app on your Android device.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">2</span>
                  <span>Tap on the <strong className="text-white">Fix & manage</strong> or <strong className="text-white">Organize / Settings</strong> tab at the bottom or top menu.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">3</span>
                  <span>Select the <strong className="text-white">Export to file</strong> option.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">4</span>
                  <span>Choose the account(s) you wish to export, tap <strong className="text-white">Export to .vcf</strong>, and select a folder to save it.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">5</span>
                  <span>Transfer that `.vcf` file to your computer or upload it directly from your phone's browser.</span>
                </li>
              </ol>
            </div>
          )}

          {tab === "ios" && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-gray-400 leading-relaxed">
                Follow these steps on your iPhone or iCloud to export your Apple Contacts as a <strong>vCard (.vcf)</strong> file:
              </p>
              <ol className="space-y-3.5 text-xs text-gray-300">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">1</span>
                  <span>Open the native <strong className="text-white">Contacts</strong> app on your iPhone.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">2</span>
                  <span>Tap <strong className="text-white">Lists</strong> in the top-left corner.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">3</span>
                  <span>Press and hold on <strong className="text-white">All Contacts</strong> (or any list you'd like to import) until the context menu pops up.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">4</span>
                  <span>Tap <strong className="text-white">Export</strong>, and choose <strong className="text-white">Save to Files</strong> (or email/AirDrop it to your desktop).</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">5</span>
                  <span>Select the file when uploading on this page.</span>
                </li>
              </ol>
              <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-400">
                💡 <strong>Alternate iCloud web method</strong>: Log in to <a href="https://icloud.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">iCloud.com</a>, open Contacts, click the gear settings icon on the bottom left, and choose <strong>Export vCard...</strong>.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
