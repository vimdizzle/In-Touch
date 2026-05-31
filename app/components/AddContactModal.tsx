"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  formatBirthdayForDB, 
  getDaysInMonth, 
  parseVCard,
  RELATIONSHIPS, 
  CADENCE_PRESETS, 
  MONTHS 
} from "@/lib/utils";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => Promise<void>;
  onImportVCards: (drafts: any[]) => void;
  onOpenImportGuide: () => void;
}

export default function AddContactModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  onImportVCards,
  onOpenImportGuide
}: AddContactModalProps) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [notes, setNotes] = useState("");
  const [lastTouchpointDate, setLastTouchpointDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setName("");
      setRelationship("Friend");
      setPhone("");
      setEmail("");
      setCadenceDays(30);
      setCity("");
      setCountry("");
      setBirthdayMonth("");
      setBirthdayDay("");
      setNotes("");
      setLastTouchpointDate("");
      setError("");
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;
    setSaving(true);
    setError("");

    try {
      const birthdayForDB = formatBirthdayForDB(birthdayMonth, birthdayDay);
      const { data, error: insertError } = await supabase
        .from("contacts")
        .insert([
          {
            user_id: userId,
            name: name.trim(),
            relationship,
            cadence_days: cadenceDays,
            city: city.trim() || null,
            country: country.trim() || null,
            birthday: birthdayForDB,
            notes: notes.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // If last touchpoint date is provided, create a touchpoint
      if (lastTouchpointDate && data.id) {
        const { error: touchpointError } = await supabase
          .from("touchpoints")
          .insert([
            {
              contact_id: data.id,
              channel: "other",
              contact_date: lastTouchpointDate,
              note: "Initial touchpoint",
            },
          ]);

        if (touchpointError) {
          console.error("Error creating touchpoint:", touchpointError);
        }
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add contact");
    } finally {
      setSaving(false);
    }
  };

  const handleVcfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseVCard(text);
        
        if (parsed.length === 0) {
          setError("No valid contacts found in the .vcf file.");
          return;
        }

        const drafts = parsed.map((c) => ({
          ...c,
          selected: true,
        }));

        onImportVCards(drafts);
      } catch (err: any) {
        console.error("vCard parsing error:", err);
        setError("Failed to parse .vcf file. Make sure it is in valid vCard format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col md:flex-row justify-end items-end md:items-stretch animate-fadeIn cursor-default"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

      {/* Drawer Panel */}
      <div 
        className="relative w-full h-[85vh] md:h-screen md:max-w-md lg:max-w-lg bg-[#0b1120] border-t md:border-t-0 md:border-l border-gray-800 rounded-t-3xl md:rounded-t-none md:rounded-l-3xl shadow-2xl flex flex-col animate-slideUp md:animate-slideInRight"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800/80 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white leading-tight">Add Contact</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
            title="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Automate Importing Block */}
          <div className="p-6 bg-[#0d1527]/55 border-b border-gray-850/60 shrink-0 space-y-3">
            <div className="flex justify-between items-center gap-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Automate Import</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Import from your device contacts or upload a .vcf file.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload .vcf
                  <input
                    type="file"
                    accept=".vcf"
                    onChange={handleVcfUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={onOpenImportGuide}
                  className="flex items-center justify-center p-2 bg-[#111827] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all duration-200 cursor-pointer"
                  title="VCF Export Instructions Guide"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                placeholder="John Doe"
              />
            </div>



            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Cadence
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CADENCE_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setCadenceDays(preset.days)}
                    className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                      cadenceDays === preset.days
                        ? "bg-cyan-500 border-cyan-500 text-white"
                        : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if ([7, 30, 90, 365].includes(cadenceDays)) {
                      setCadenceDays(45);
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                    ![7, 30, 90, 365].includes(cadenceDays)
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  Custom
                </button>
              </div>

              {![7, 30, 90, 365].includes(cadenceDays) && (
                <div className="flex items-center gap-2 animate-fadeIn mt-2 pl-1">
                  <input
                    type="number"
                    value={cadenceDays}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") setCadenceDays(0);
                      else {
                        const num = parseInt(val);
                        if (!isNaN(num) && num > 0) setCadenceDays(num);
                      }
                    }}
                    min="1"
                    className="w-24 px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <span className="text-gray-400 text-sm">days</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="San Jose"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="United States"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Birthday
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={birthdayMonth}
                    onChange={(e) => {
                      setBirthdayMonth(e.target.value);
                      if (e.target.value) {
                        const days = getDaysInMonth(e.target.value);
                        if (birthdayDay && parseInt(birthdayDay) > days.length) {
                          setBirthdayDay("");
                        }
                      } else {
                        setBirthdayDay("");
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={birthdayDay}
                    onChange={(e) => setBirthdayDay(e.target.value)}
                    disabled={!birthdayMonth}
                    className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50"
                  >
                    <option value="">Day</option>
                    {birthdayMonth && getDaysInMonth(birthdayMonth).map((d) => (
                      <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Last Contact Date
                </label>
                <input
                  type="date"
                  value={lastTouchpointDate}
                  onChange={(e) => setLastTouchpointDate(e.target.value)}
                  className="w-full h-[38px] px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm appearance-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 bg-[#111827] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                placeholder="Notes..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-md text-xs">
                {error}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-gray-800/80 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-600 hover:bg-[#111827] transition-all duration-200 cursor-pointer"
                title="Cancel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-12 h-12 flex items-center justify-center text-cyan-400 hover:text-white border border-cyan-500/50 rounded-full hover:border-cyan-500 hover:bg-cyan-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                title="Add Contact"
              >
                {saving ? (
                  <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
