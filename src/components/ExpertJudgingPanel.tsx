"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveExpertPlacings, overrideFinalPlacings } from "@/app/actions/shows";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageCircle } from "lucide-react";

interface EntryForJudging {
  id: string;
  horseName: string;
  ownerAlias: string;
  thumbnailUrl: string | null;
  placing: string | null;
  classId: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
  divisionName: string;
}

const RIBBON_OPTIONS = [
  { value: "1st", label: "🥇 1st", bg: "bg-amber-100 border-amber-300 text-amber-800" },
  { value: "2nd", label: "🥈 2nd", bg: "bg-muted border-stone-400 text-foreground" },
  { value: "3rd", label: "🥉 3rd", bg: "bg-orange-100 border-orange-300 text-orange-800" },
  { value: "4th", label: "4th", bg: "bg-muted border-stone-300 text-secondary-foreground" },
  { value: "5th", label: "5th", bg: "bg-muted border-stone-300 text-secondary-foreground" },
  { value: "6th", label: "6th", bg: "bg-muted border-stone-300 text-secondary-foreground" },
  { value: "HM", label: "🎗️ HM", bg: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { value: "Champion", label: "🏆 Champ", bg: "bg-amber-200 border-amber-400 text-amber-900" },
  { value: "Reserve Champion", label: "🥈 Reserve", bg: "bg-muted border-stone-400 text-foreground" },
];

const MEDAL_EMOJI: Record<string, string> = {
  "1st": "🥇", "2nd": "🥈", "3rd": "🥉",
  "4th": "4th", "5th": "5th", "6th": "6th",
  "HM": "🎗️",
  "Champion": "🏆", "Reserve Champion": "🥈",
  "Grand Champion": "🏆", "Reserve Grand Champion": "🥈",
  "Top 3": "🏅", "Top 5": "🏅", "Top 10": "🏅",
};

const RIBBON_BADGE_COLORS: Record<string, string> = {
  "1st": "bg-amber-500 text-white",
  "2nd": "bg-stone-400 text-white",
  "3rd": "bg-orange-500 text-white",
  "4th": "bg-stone-300 text-foreground",
  "5th": "bg-stone-300 text-foreground",
  "6th": "bg-stone-300 text-foreground",
  "HM": "bg-emerald-500 text-white",
  "Champion": "bg-amber-600 text-white",
  "Reserve Champion": "bg-stone-500 text-white",
  "Grand Champion": "bg-amber-600 text-white",
  "Reserve Grand Champion": "bg-stone-500 text-white",
};

const MULTI_ALLOWED = ["HM", "Top 3", "Top 5", "Top 10"];

export default function ExpertJudgingPanel({
  showId,
  entries,
  classes,
  overrideMode = false,
}: {
  showId: string;
  entries: EntryForJudging[];
  classes?: ClassInfo[];
  overrideMode?: boolean;
}) {
  const router = useRouter();
  const [placings, setPlacings] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    entries.forEach((e) => {
      if (e.placing) init[e.id] = e.placing;
    });
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [activeRibbon, setActiveRibbon] = useState<string | null>(null);

  // Filter entries by selected class
  const filteredEntries = selectedClassId === "all"
    ? entries
    : entries.filter((e) => e.classId === selectedClassId);

  // Find current class info
  const currentClass = classes?.find((c) => c.id === selectedClassId);

  // Group classes by division for the selector
  const divisionGroups: Map<string, ClassInfo[]> = new Map();
  if (classes && classes.length > 0) {
    for (const c of classes) {
      const group = divisionGroups.get(c.divisionName) || [];
      group.push(c);
      divisionGroups.set(c.divisionName, group);
    }
  }

  // Handle pinning a ribbon to an entry
  const handlePinRibbon = (entryId: string) => {
    if (!activeRibbon) return;

    // Toggle off if already assigned
    if (placings[entryId] === activeRibbon) {
      setPlacings((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      return;
    }

    // Uniqueness check for singular awards (within filtered entries)
    if (!MULTI_ALLOWED.includes(activeRibbon)) {
      const scopeIds = new Set(filteredEntries.map((e) => e.id));
      const existingEntry = Object.entries(placings).find(
        ([id, placing]) => placing === activeRibbon && id !== entryId && scopeIds.has(id)
      );
      if (existingEntry) {
        setPlacings((prev) => {
          const next = { ...prev };
          delete next[existingEntry[0]];
          return next;
        });
      }
    }

    // Assign ribbon
    setPlacings((prev) => ({ ...prev, [entryId]: activeRibbon }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    const toSave = Object.entries(placings)
      .filter(([, v]) => v !== "")
      .map(([entryId, placing]) => ({
        entryId,
        placing,
        notes: notes[entryId]?.trim() || undefined,
      }));

    if (toSave.length === 0) {
      setError("Please assign at least one placing.");
      setSaving(false);
      return;
    }

    let result: { success: boolean; error?: string };
    if (overrideMode) {
      result = await overrideFinalPlacings(showId, toSave);
    } else {
      result = await saveExpertPlacings(showId, toSave);
    }

    if (result.success) {
      setSuccess(true);
      router.refresh();
    } else {
      setError(result.error || "Failed to save placings.");
    }
    setSaving(false);
  };

  const placedCount = Object.keys(placings).filter((k) => placings[k]).length;

  return (
    <div
      className={`animate-fade-in-up mb-6 rounded-xl border p-6 shadow-sm ${
        overrideMode ? "border-red-200 bg-red-50/30" : "border-input bg-[#FEFCF8]"
      }`}
    >
      {/* Header */}
      <h3 className="mb-2 flex items-center gap-2 font-serif text-lg">
        {overrideMode ? "⚠️" : "🏅"}{" "}
        <span className={overrideMode ? "text-red-600" : "text-forest"}>
          {overrideMode ? "Override Final Placings" : "Expert Judging Panel"}
        </span>
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {overrideMode
          ? "Adjust placings after the show has been judged or closed."
          : "Select a ribbon below, then click a photo to stamp it. Click again to remove."}
      </p>

      {/* Class Filter */}
      {classes && classes.length > 0 && (
        <div className="mb-4">
          <select
            className="flex h-10 max-w-[400px] rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            title="Filter by class"
          >
            <option value="all">All Entries ({entries.length})</option>
            {Array.from(divisionGroups.entries()).map(([divName, items]) => (
              <optgroup key={divName} label={divName}>
                {items.map((c) => {
                  const count = entries.filter((e) => e.classId === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({count})
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          {currentClass && (
            <div className="mt-1 text-sm text-muted-foreground">
              Judging: <strong>{currentClass.divisionName}</strong> ›{" "}
              <strong>{currentClass.name}</strong>
            </div>
          )}
        </div>
      )}

      {/* ─── Ribbon Palette (Sticky) ─── */}
      <Card className="sticky top-0 z-20 mb-6 border-input bg-[#FEFCF8] shadow-sm">
        <CardContent className="flex flex-wrap gap-2 p-3">
          {RIBBON_OPTIONS.map((ribbon) => {
            const isActive = activeRibbon === ribbon.value;
            return (
              <button
                key={ribbon.value}
                type="button"
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                  isActive
                    ? `ring-2 ring-forest scale-105 shadow-lg ${ribbon.bg}`
                    : `border-input bg-[#FEFCF8] text-secondary-foreground hover:shadow-md hover:border-input`
                }`}
                onClick={() => setActiveRibbon(isActive ? null : ribbon.value)}
              >
                {ribbon.label}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {activeRibbon && (
        <div className="mb-4 rounded-md border border-forest/20 bg-forest/5 px-4 py-2 text-sm text-forest">
          🎯 <strong>{MEDAL_EMOJI[activeRibbon]} {activeRibbon}</strong> selected — click a photo to stamp it
        </div>
      )}

      {/* ─── Entry Grid ─── */}
      {filteredEntries.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No entries {selectedClassId !== "all" ? "in this class" : "to judge"}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {filteredEntries.map((entry) => (
            <Card
              key={entry.id}
              className={`overflow-hidden border-input transition-all ${
                placings[entry.id] ? "ring-1 ring-forest/30" : ""
              }`}
            >
              {/* Image area — click target */}
              <Popover>
                <div className="relative">
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className={`relative cursor-pointer ${!activeRibbon ? "cursor-default" : ""}`}
                    onClick={() => handlePinRibbon(entry.id)}
                  >
                    {entry.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.thumbnailUrl}
                        alt={entry.horseName}
                        className="aspect-[4/3] w-full rounded-t-lg object-contain bg-muted"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-lg bg-muted text-4xl">
                        🐴
                      </div>
                    )}

                    {/* Ribbon Badge Overlay */}
                    <AnimatePresence>
                      {placings[entry.id] && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          className="absolute top-2 right-2 z-10"
                        >
                          <Badge
                            className={`px-3 py-1 text-sm shadow-lg ${
                              RIBBON_BADGE_COLORS[placings[entry.id]] || "bg-forest text-white"
                            }`}
                          >
                            {MEDAL_EMOJI[placings[entry.id]] || "🏅"} {placings[entry.id]}
                          </Badge>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* No-ribbon hint overlay */}
                    {!activeRibbon && !placings[entry.id] && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                          Select a ribbon first
                        </span>
                      </div>
                    )}
                  </motion.div>

                  {/* Judge Notes Button (Popover) */}
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Judge notes"
                      className="absolute bottom-2 right-2 z-10 rounded-full bg-[#FEFCF8]/90 p-2 shadow transition-all hover:bg-[#FEFCF8]"
                    >
                      <MessageCircle
                        className={`h-4 w-4 ${
                          notes[entry.id] ? "text-forest" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <Textarea
                      value={notes[entry.id] || ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))
                      }
                      placeholder="Private judge critique…"
                      rows={3}
                      className="text-sm"
                    />
                  </PopoverContent>
                </div>
              </Popover>

              {/* Entry Info */}
              <CardContent className="p-3">
                <div className="text-sm font-semibold text-foreground">
                  🐴 {entry.horseName}
                </div>
                <div className="text-xs text-muted-foreground">
                  by @{entry.ownerAlias}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error / Success */}
      {error && <div className="mt-4 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          ✅ Placings saved!{" "}
          {overrideMode
            ? "Show records updated with audit trail."
            : "Show records auto-generated for placed entries."}
        </div>
      )}

      {/* Save Button + Summary */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {placedCount} of {filteredEntries.length} entries placed
        </span>
        <button
          className={`inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md px-6 py-2 text-sm font-semibold shadow-sm transition-all ${
            overrideMode
              ? "border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-0 bg-forest text-white hover:bg-forest/90"
          }`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : overrideMode ? "⚠️ Override Placings" : "💾 Save Placings"}
        </button>
      </div>
    </div>
  );
}
