"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ImportingContactDraft, 
  Contact, 
  RELATIONSHIPS, 
  formatBirthdayForDB 
} from "@/lib/utils";

interface VCardImportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  importingContacts: ImportingContactDraft[];
  userId: string;
  onImportSuccess: (importedContacts: Contact[]) => void;
  onImportError: (errorMessage: string) => void;
}

export default function VCardImportReviewModal({
  isOpen,
  onClose,
  importingContacts: initialContacts,
  userId,
  onImportSuccess,
  onImportError,
}: VCardImportReviewModalProps) {
  const [drafts, setDrafts] = useState<ImportingContactDraft[]>([]);
  const [bulkRelationship, setBulkRelationship] = useState("Friend");
  const [bulkCadenceDays, setBulkCadenceDays] = useState(30);
  const [saving, setSaving] = useState(false);

  // Synchronize internal state when prop changes
  useEffect(() => {
    setDrafts(initialContacts);
  }, [initialContacts]);

  if (!isOpen) return null;

  const applyBulkRelationship = (val: string) => {
    setBulkRelationship(val);
    setDrafts((prev) =>
      prev.map((c) => (c.selected ? { ...c, relationship: val } : c))
    );
  };

  const applyBulkCadence = (val: number) => {
    setBulkCadenceDays(val);
    setDrafts((prev) =>
      prev.map((c) => (c.selected ? { ...c, cadence_days: val } : c))
    );
  };

  const toggleSelect = (index: number) => {
    setDrafts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleAll = (selected: boolean) => {
    setDrafts((prev) => prev.map((c) => ({ ...c, selected })));
  };

  const handleFieldChange = <K extends keyof ImportingContactDraft>(
    index: number,
    field: K,
    value: ImportingContactDraft[K]
  ) => {
    setDrafts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleConfirmImport = async () => {
    const selected = drafts.filter((c) => c.selected);
    if (selected.length === 0) return;

    setSaving(true);
    try {
      const inserts = selected.map((c) => {
        let birthdayForDB = null;
        if (c.birthday) {
          const parts = c.birthday.split("-");
          birthdayForDB = formatBirthdayForDB(parts[0], parts[1]);
        }

        return {
          user_id: userId,
          name: c.name.trim(),
          relationship: c.relationship,
          cadence_days: c.cadence_days,
          city: c.city?.trim() || null,
          country: c.country?.trim() || null,
          birthday: birthdayForDB,
          phone: c.phone?.trim() || null,
          email: c.email?.trim() || null,
          notes: c.notes?.trim() || null,
        };
      });

      const { data, error } = await supabase
        .from("contacts")
        .insert(inserts)
        .select();

      if (error) throw error;

      if (data) {
        onImportSuccess(data);
      }
    } catch (err) {
      console.error("Bulk Import Error:", err);
      onImportError(err instanceof Error ? err.message : "Failed to import contacts");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1120] border border-gray-800 rounded-3xl max-w-2xl w-full overflow-hidden animate-scaleUp shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/80 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">Review Imported Contacts</h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
              Select the contacts you want to add, update details, or set bulk options.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white border border-gray-800 rounded-full hover:bg-[#111827] cursor-pointer shrink-0"
            title="Cancel Import"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Bulk Edit Panel */}
        <div className="p-4 bg-[#0d1527] border-b border-gray-850/80 shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Bulk Relationship
            </label>
            <select
              value={bulkRelationship}
              onChange={(e) => applyBulkRelationship(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#111827] border border-gray-700 rounded-md text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              {RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Bulk Cadence
            </label>
            <div className="flex gap-2">
              {[
                { label: "Weekly", days: 7 },
                { label: "Monthly", days: 30 },
                { label: "Quarterly", days: 90 },
                { label: "Yearly", days: 365 },
              ].map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => applyBulkCadence(preset.days)}
                  className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded border transition-colors cursor-pointer text-center ${
                    bulkCadenceDays === preset.days
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-[#111827] border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Select All / Status Header */}
        <div className="px-6 py-2 bg-[#090d1a] border-b border-gray-850/80 shrink-0 flex justify-between items-center text-[10px] font-semibold text-gray-400">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={drafts.length > 0 && drafts.every((c) => c.selected)}
              onChange={(e) => toggleAll(e.target.checked)}
              className="rounded bg-[#111827] border-gray-700 text-cyan-500 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer"
              id="selectAllImportModal"
            />
            <label htmlFor="selectAllImportModal" className="cursor-pointer select-none">
              Select All ({drafts.length})
            </label>
          </div>
          <span>
            {drafts.filter((c) => c.selected).length} selected
          </span>
        </div>

        {/* Scrollable List of Parsed Contacts */}
        <div className="flex-1 overflow-y-auto p-4 pr-3 custom-scrollbar divide-y divide-gray-850/40">
          {drafts.map((contact, idx) => (
            <div key={idx} className="py-3 flex items-start gap-3.5">
              {/* Selection Checkbox */}
              <input
                type="checkbox"
                checked={contact.selected}
                onChange={() => toggleSelect(idx)}
                className="mt-1.5 rounded bg-[#111827] border-gray-700 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer shrink-0"
              />

              {/* Contact details */}
              <div className="flex-1 space-y-2 min-w-0">
                {/* Name input */}
                <div>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                    className="w-full px-2 py-1 bg-[#111827] border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
                    placeholder="Contact Name"
                  />
                </div>

                {/* Display of parsed metadata */}
                <div className="flex flex-wrap gap-1.5 font-sans">
                  {contact.phone && (
                    <span className="text-[9px] text-gray-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                      📞 {contact.phone}
                    </span>
                  )}
                  {contact.email && (
                    <span className="text-[9px] text-gray-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 truncate max-w-[180px]" title={contact.email}>
                      ✉️ {contact.email}
                    </span>
                  )}
                  {(contact.city || contact.country) && (
                    <span className="text-[9px] text-cyan-400/90 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                      📍 {[contact.city, contact.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {contact.birthday && (
                    <span className="text-[9px] text-indigo-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                      🎂 {contact.birthday}
                    </span>
                  )}
                  {contact.notes && (
                    <span className="text-[9px] text-amber-400/80 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded truncate max-w-[180px]" title={contact.notes}>
                      📝 {contact.notes}
                    </span>
                  )}
                </div>

                {/* Single relationship and cadence picker inside the row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-semibold uppercase">Type:</span>
                    <select
                      value={contact.relationship}
                      onChange={(e) => handleFieldChange(idx, "relationship", e.target.value)}
                      className="bg-[#111827] border border-gray-700 text-white text-[10px] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-semibold uppercase">Cadence:</span>
                    <select
                      value={contact.cadence_days}
                      onChange={(e) => handleFieldChange(idx, "cadence_days", parseInt(e.target.value))}
                      className="bg-[#111827] border border-gray-700 text-white text-[10px] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                    >
                      <option value={7}>Weekly (7d)</option>
                      <option value={30}>Monthly (30d)</option>
                      <option value={90}>Quarterly (90d)</option>
                      <option value={365}>Yearly (365d)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-800/80 bg-[#0d1527] shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-700 hover:border-gray-500 hover:bg-[#111827] text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={saving || drafts.filter((c) => c.selected).length === 0}
            className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importing...
              </>
            ) : (
              <>
                Confirm Import ({drafts.filter((c) => c.selected).length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
