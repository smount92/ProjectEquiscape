"use client";

import { useState } from"react";
import { saveExpertPlacings } from"@/app/actions/shows";

interface Entry {
 id: string;
 horseName: string;
 ownerAlias: string;
 placing?: string;
}

export default function AssignPlacings({
 eventId,
 entries,
 onSave,
}: {
 eventId?: string;
 entries: Entry[];
 onSave?: (placings: { entryId: string; placing: string }[]) => Promise<void>;
}) {
 const [placings, setPlacings] = useState<Record<string, string>>(() => {
 const init: Record<string, string> = {};
 entries.forEach((e) => {
 if (e.placing) init[e.id] = e.placing;
 });
 return init;
 });
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);
 const [error, setError] = useState("");

 const handleSave = async () => {
 setSaving(true);
 setError("");
 setSaved(false);
 const data = Object.entries(placings)
 .filter(([, v]) => v)
 .map(([entryId, placing]) => ({ entryId, placing }));

 if (onSave) {
 await onSave(data);
 } else if (eventId) {
 const result = await saveExpertPlacings(eventId, data);
 if (!result.success) {
 setError(result.error ||"Failed to save.");
 setSaving(false);
 return;
 }
 }
 setSaving(false);
 setSaved(true);
 };

 if (entries.length === 0) return null;

 return (
 <div className="bg-card border-edge mt-6 rounded-lg border p-6 shadow-md transition-all">
 <h3 className="mb-4">🏅 Assign Placings</h3>
 <p className="text-muted mb-4 text-sm">As the event host, assign placings to each entry below.</p>
 <div className="flex flex-col gap-2">
 {entries.map((entry) => (
 <div key={entry.id} className="flex items-center gap-2">
 <span className="flex-1">
 <strong>{entry.horseName}</strong>
 <span className="text-muted ml-1">by @{entry.ownerAlias}</span>
 </span>
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[140px]"
 value={placings[entry.id] ||""}
 onChange={(e) => setPlacings((prev) => ({ ...prev, [entry.id]: e.target.value }))}
 title={`Placing for ${entry.horseName}`}
 >
 <option value="">—</option>
 <option value="1st">🥇 1st</option>
 <option value="2nd">🥈 2nd</option>
 <option value="3rd">🥉 3rd</option>
 <option value="4th">4th</option>
 <option value="5th">5th</option>
 <option value="HM">HM</option>
 <option value="Champion">🏆 Champion</option>
 <option value="Reserve">🎖️ Reserve</option>
 </select>
 </div>
 ))}
 </div>

 {error && <div className="mt-2 text-sm text-danger mt-2">{error}</div>}

 <div className="mt-6 flex items-center gap-2">
 <button
 className="inline-flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSave}
 disabled={saving || Object.values(placings).filter((v) => v).length === 0}
 >
 {saving ?"Saving…" : `💾 Save ${Object.values(placings).filter((v) => v).length} Placings`}
 </button>
 {saved && (
 <span className="text-forest whitespace-nowrap font-semibold">
 ✅ Saved!
 </span>
 )}
 </div>
 </div>
 );
}
