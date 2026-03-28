"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { createGroup } from"@/app/actions/groups";

import { GROUP_TYPE_LABELS } from"@/lib/constants/groups";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from"@/components/layouts/FocusLayout";

export default function CreateGroupPage() {
 const router = useRouter();
 const [name, setName] = useState("");
 const [slug, setSlug] = useState("");
 const [description, setDescription] = useState("");
 const [groupType, setGroupType] = useState("general");
 const [region, setRegion] = useState("");
 const [visibility, setVisibility] = useState("public");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");

 function autoSlug(value: string) {
 setName(value);
 setSlug(
  value
  .toLowerCase()
  .replace(/[^a-z0-9-]/g,"-")
  .replace(/-+/g,"-")
  .replace(/^-|-$/g,""),
 );
 }

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setSaving(true);
 setError("");

 const result = await createGroup({
  name: name.trim(),
  slug,
  description: description.trim() || undefined,
  groupType,
  region: region.trim() || undefined,
  visibility,
 });

 if (result.success && result.slug) {
  router.push(`/community/groups/${result.slug}`);
 } else {
  setError(result.error ||"Failed to create group");
  setSaving(false);
 }
 }

 return (
 <FocusLayout
  title="🏛️ Create Group"
 >
  <form onSubmit={handleSubmit}>
  <div className="mb-6">
   <label className="text-stone-900 mb-1 block text-sm font-semibold">Group Name *</label>
   <Input
   value={name}
   onChange={(e) => autoSlug(e.target.value)}
   placeholder="Pacific Northwest Model Horse Collectors"
   required
   />
  </div>

  <div className="mb-6">
   <label className="text-stone-900 mb-1 block text-sm font-semibold">URL Slug</label>
   <Input
   value={slug}
   onChange={(e) => setSlug(e.target.value)}
   placeholder="pnw-collectors"
   />
   <small className="text-stone-500">modelhorsehub.com/community/groups/{slug ||"your-slug"}</small>
  </div>

  <div className="mb-6">
   <label className="text-stone-900 mb-1 block text-sm font-semibold">Description</label>
   <Textarea
   className="w-full resize-y"
   rows={3}
   value={description}
   onChange={(e) => setDescription(e.target.value)}
   placeholder="What is this group about?"
   />
  </div>

  <div className="grid grid-cols-2 gap-4">
   <div className="mb-6">
   <label className="text-stone-900 mb-1 block text-sm font-semibold">Group Type *</label>
   <select
    className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    value={groupType}
    onChange={(e) => setGroupType(e.target.value)}
    title="Group type"
   >
    {Object.entries(GROUP_TYPE_LABELS).map(([key, label]) => (
    <option key={key} value={key}>
     {label}
    </option>
    ))}
   </select>
   </div>
   <div className="mb-6">
   <label className="text-stone-900 mb-1 block text-sm font-semibold">Region</label>
   <Input
    value={region}
    onChange={(e) => setRegion(e.target.value)}
    placeholder="e.g. Pacific Northwest"
   />
   </div>
  </div>

  <div className="mb-6">
   <label className="text-stone-900 mb-1 block text-sm font-semibold">Visibility</label>
   <div className="flex gap-2">
   {["public","restricted","private"].map((v) => (
    <button
    key={v}
    type="button"
    className={`studio-status-btn ${visibility === v ? `active-${v ==="public" ?"open" : v ==="restricted" ?"waitlist" :"closed"}` :""}`}
    onClick={() => setVisibility(v)}
    >
    {v ==="public" ?"🌐 Public" : v ==="restricted" ?"🔒 Restricted" :"🔐 Private"}
    </button>
   ))}
   </div>
  </div>

  {error && (
   <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
   {error}
   </p>
  )}

  <div className="mt-6 flex gap-2">
   <button
   type="submit"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   disabled={saving || !name.trim()}
   >
   {saving ?"Creating..." :"Create Group"}
   </button>
   <button
   type="button"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
   onClick={() => router.push("/community/groups")}
   >
   Cancel
   </button>
  </div>
  </form>
 </FocusLayout>
 );
}
