"use client";

import { Contact } from "@/lib/utils";

interface ReachOutModalProps {
  contact: Contact | null;
  onClose: () => void;
}

export default function ReachOutModal({ contact, onClose }: ReachOutModalProps) {
  if (!contact) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-default"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-sm w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800/80">
          <h3 className="text-xl font-bold text-white">{contact.name}</h3>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">{contact.relationship}</p>
        </div>

        {/* Actions List */}
        <div className="divide-y divide-gray-800/80">
          {contact.phone ? (
            <>
              {/* Call Row */}
              <a
                href={`tel:${contact.phone}`}
                onClick={onClose}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#111827] transition-colors group"
              >
                <div className="text-left">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Phone</span>
                  <div className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                    {contact.phone}
                  </div>
                </div>
                <div className="text-gray-400 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.302a12.01 12.01 0 01-5.907-5.907c-.44-.44-.274-.927.102-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
              </a>

              {/* Text Row */}
              <a
                href={`sms:${contact.phone}`}
                onClick={onClose}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#111827] transition-colors group"
              >
                <div className="text-left">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Text Message</span>
                  <div className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                    {contact.phone}
                  </div>
                </div>
                <div className="text-gray-400 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501c1.153-.086 2.294-.21 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
              </a>
            </>
          ) : (
            <div className="px-6 py-4 text-center">
              <p className="text-xs text-gray-400 italic">No phone number configured.</p>
            </div>
          )}

          {contact.email ? (
            /* Email Row */
            <a
              href={`mailto:${contact.email}`}
              onClick={onClose}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#111827] transition-colors group"
            >
              <div className="text-left">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Email</span>
                <div className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors break-all pr-2">
                  {contact.email}
                </div>
              </div>
              <div className="text-gray-400 group-hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
            </a>
          ) : (
            <div className="px-6 py-4 text-center">
              <p className="text-xs text-gray-400 italic">No email configured.</p>
            </div>
          )}
        </div>

        {/* Close Button Panel */}
        <div className="p-6 bg-[#070b14]/50 border-t border-gray-800/80 flex items-center justify-center w-full">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-700 rounded-full text-sm font-semibold text-gray-400 hover:text-white hover:border-gray-500 transition-colors cursor-pointer"
          >
            Close Menu
          </button>
        </div>
      </div>
    </div>
  );
}
