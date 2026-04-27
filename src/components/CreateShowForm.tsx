"use client";

import { useState } from "react";
import { createPhotoShow } from "@/app/actions/shows";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHOW_TEMPLATES } from "@/lib/constants/showTemplates";

export default function CreateShowForm() {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [endAt, setEndAt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [isNamhsaSanctioned, setIsNamhsaSanctioned] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || status === "saving") return;

    setStatus("saving");
    setErrorMsg("");

    const result = await createPhotoShow({
      title: title.trim(),
      theme: theme.trim() || undefined,
      description: description.trim() || undefined,
      endAt: endAt || undefined,
      templateId: templateId || undefined,
      sanctioningBody: isNamhsaSanctioned ? "namhsa" : undefined,
    });

    if (result.success) {
      setStatus("saved");
      setTitle("");
      setTheme("");
      setDescription("");
      setEndAt("");
      setTemplateId("");
      setIsNamhsaSanctioned(false);
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setErrorMsg(result.error || "Failed to create show.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const selectedTemplate = SHOW_TEMPLATES.find((t) => t.key === templateId);

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[500px] flex-col gap-4">
      {/* Template Selector */}
      <div className="mb-6">
        <label className="text-ink mb-1 block text-sm font-semibold">
          Starting Template (optional)
        </label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger>
            <SelectValue placeholder="No template — blank show" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No template — blank show</SelectItem>
            {SHOW_TEMPLATES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTemplate && (
          <p className="mt-1 text-xs text-muted">{selectedTemplate.description}</p>
        )}
      </div>

      <div className="mb-6">
        <label className="text-foreground mb-1 block text-sm font-semibold">Show Title</label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spring Breyer Showcase"
          required
        />
      </div>
      <div className="mb-6">
        <label className="text-foreground mb-1 block text-sm font-semibold">Theme (optional)</label>
        <Input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="e.g. Best OF Breyer"
        />
      </div>
      <div className="mb-6">
        <label className="text-foreground mb-1 block text-sm font-semibold">
          Description (optional)
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Show rules and details…"
          rows={2}
        />
      </div>

      <div className="mb-6">
        <label className="text-foreground mb-1 block text-sm font-semibold">
          Entries Close (optional)
        </label>
        <Input
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
        />
        <p className="text-muted-foreground mt-[4px] text-xs">
          Leave blank for no deadline. Show stays open until manually closed.
        </p>
      </div>

      {/* NAMHSA Sanctioned */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isNamhsaSanctioned}
            onChange={(e) => setIsNamhsaSanctioned(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-forest accent-forest"
          />
          <span className="text-sm font-semibold text-foreground">
            🏛️ NAMHSA Sanctioned Show
          </span>
        </label>
        <p className="mt-1 ml-7 text-xs text-muted-foreground">
          Mark this show as sanctioned by the North American Model Horse Shows Association.
        </p>
      </div>

      {status === "error" && errorMsg && (
        <div className="mb-4 mt-2 text-sm text-red-700">{errorMsg}</div>
      )}
      {status === "saved" && (
        <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-[#22C55E]">
          ✅ Show created!
        </div>
      )}

      <button
        type="submit"
        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
        disabled={status === "saving"}
      >
        {status === "saving" ? "Creating…" : "📸 Create Photo Show"}
      </button>
    </form>
  );
}
