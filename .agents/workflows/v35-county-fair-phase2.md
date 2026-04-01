---
description: "Digital County Fair Phase 2 — 1-Click NAMHSA Show Templates. Authentic class list presets for instant show setup."
---

# 📋 Phase 2: 1-Click NAMHSA Show Templates

**Epic:** Digital County Fair UX  
**Goal:** Prevent host fatigue by allowing 1-click generation of authentic, real-world class lists when creating a new photo show.

---

## Task 2.1: Create the Template Data

**Target File:** `src/lib/constants/showTemplates.ts` (CREATE — does not exist yet)

**Current directory:** `src/lib/constants/` contains `events.ts` and `groups.ts`

### Required Implementation

Export a typed constant `SHOW_TEMPLATES` containing three predefined show structures. Each template has a `key`, `label`, `description`, and a `divisions` array, where each division has a `name` and `classes` array.

```typescript
export interface ShowTemplateClass {
  name: string;
  classNumber?: string;
  isNanQualifying?: boolean;
}

export interface ShowTemplateDivision {
  name: string;
  classes: ShowTemplateClass[];
}

export interface ShowTemplate {
  key: string;
  label: string;
  description: string;
  divisions: ShowTemplateDivision[];
}

export const SHOW_TEMPLATES: ShowTemplate[] = [
  // Template 1: Standard Halter (NAMHSA Style)
  // Template 2: Performance Standard
  // Template 3: Collectibility & Fun
];
```

### Template 1: Standard Halter (NAMHSA Style)

| Division | Classes |
|---|---|
| Light Breeds | Arabian, Part-Arabian, Morgan, Saddlebred, Other Light/Gaited |
| Sport Breeds | Thoroughbred/Standardbred, Warmblood, Carriage Breeds, Other Sport |
| Stock Breeds | Quarter Horse, Appaloosa, Paint, Mustang, Other Stock |
| Draft & Pony | British Draft, European Draft, American Pony, European Pony |
| Other | Longears/Exotics, Foals |

Auto-assign sequential `classNumber` values starting from `"101"`.

### Template 2: Performance Standard

| Division | Classes |
|---|---|
| Western | Western Pleasure, Western Trail, Western Games, Stock Work/Cutting/Roping |
| English | Huntseat Pleasure, Hunter over Fences, Jumper, Dressage, Cross Country |
| Other | Harness/Driving, Costume, Scene, Showmanship |

Auto-assign sequential `classNumber` values starting from `"201"`.

### Template 3: Collectibility & Fun

| Division | Classes |
|---|---|
| Breyer Collectibility | Vintage (Pre-1990), Decorator/Woodgrain, Glossy Finish, Limited/Special Run |
| Fun Classes | Best Customization, Unrealistic Color, "Fails & Flaws", Fantasy/Unicorn |

Auto-assign sequential `classNumber` values starting from `"301"`.

### Validation
- [ ] File exports `SHOW_TEMPLATES` with 3 templates
- [ ] Each template has a unique `key` (`standard_halter`, `performance_standard`, `collectibility_fun`)
- [ ] Total class count across all templates: Standard Halter has ~17, Performance has ~13, Collectibility has ~8
- [ ] TypeScript types are properly exported for reuse

---

## Task 2.2: Implement Template Injection

**Target Files:**
- `src/components/CreateShowForm.tsx` (108 lines)
- `src/app/actions/shows.ts` — function `createPhotoShow()` (~line 425–456)

### Step A: Update `CreateShowForm.tsx`

**Current state:** Simple form with title, theme, description, endAt fields. Uses `shadcn/ui` `Input` and `Textarea`.

1. **Import the templates:**
   ```typescript
   import { SHOW_TEMPLATES } from "@/lib/constants/showTemplates";
   ```

2. **Add template state:** Add a `useState` for `templateId`:
   ```typescript
   const [templateId, setTemplateId] = useState("");
   ```

3. **Add the template selector** (as a `shadcn/ui` `<Select>` component):
   - Import `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`
   - **Note:** Check if `src/components/ui/select.tsx` exists. If not, install it first via `npx shadcn@latest add select` (but it's already listed in the onboard as an existing shadcn primitive, so it should exist).
   - Place the selector ABOVE the Title field, as the first form element:
     ```tsx
     <div className="mb-6">
       <label className="text-ink mb-1 block text-sm font-semibold">
         Starting Template (optional)
       </label>
       <Select value={templateId} onValueChange={setTemplateId}>
         <SelectTrigger>
           <SelectValue placeholder="No template — blank show" />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="">No template — blank show</SelectItem>
           {SHOW_TEMPLATES.map((t) => (
             <SelectItem key={t.key} value={t.key}>
               {t.label}
             </SelectItem>
           ))}
         </SelectContent>
       </Select>
       {templateId && (
         <p className="mt-1 text-xs text-muted">
           {SHOW_TEMPLATES.find(t => t.key === templateId)?.description}
         </p>
       )}
     </div>
     ```

4. **Pass `templateId` to the server action:**.
   - Update the `createPhotoShow()` call (line 23–28) to include `templateId`:
     ```typescript
     const result = await createPhotoShow({
       title: title.trim(),
       theme: theme.trim() || undefined,
       description: description.trim() || undefined,
       endAt: endAt || undefined,
       templateId: templateId || undefined,
     });
     ```
   - Reset `templateId` on success alongside the other fields.

### Step B: Update `createPhotoShow()` Server Action

**File:** `src/app/actions/shows.ts` — function `createPhotoShow()` (~line 425–456)

1. **Update the function signature** (line 425–429):
   ```typescript
   export async function createPhotoShow(data: {
     title: string;
     description?: string;
     theme?: string;
     endAt?: string;
     templateId?: string;  // ADD THIS
   }): Promise<{ success: boolean; error?: string }> {
   ```

2. **After the events INSERT succeeds** (after line 451), add template injection:
   ```typescript
   // Template injection: auto-populate divisions & classes
   if (data.templateId) {
     const { SHOW_TEMPLATES } = await import("@/lib/constants/showTemplates");
     const template = SHOW_TEMPLATES.find(t => t.key === data.templateId);
     
     if (template) {
       // We need the newly created event's ID
       // PROBLEM: The current INSERT doesn't return the ID!
       // SOLUTION: Change the insert to use .select("id").single()
       // to get the new event's UUID back.
     }
   }
   ```

3. **Critical fix:** The current `events` INSERT (lines 439–449) does NOT return the inserted row's ID. You MUST modify it to get the ID back:
   
   Change from:
   ```typescript
   const { error } = await admin.from("events").insert({...});
   ```
   To:
   ```typescript
   const { data: newEvent, error } = await admin.from("events").insert({...}).select("id").single();
   ```
   
   Then use `newEvent.id` for the template injection.

4. **Template injection loop** (after the insert):
   ```typescript
   if (data.templateId && newEvent) {
     const { SHOW_TEMPLATES } = await import("@/lib/constants/showTemplates");
     const template = SHOW_TEMPLATES.find(t => t.key === data.templateId);
     
     if (template) {
       for (let di = 0; di < template.divisions.length; di++) {
         const div = template.divisions[di];
         
         // Insert division
         const { data: newDiv } = await admin.from("event_divisions").insert({
           event_id: newEvent.id,
           name: div.name,
           sort_order: di,
         }).select("id").single();
         
         if (newDiv) {
           // Bulk insert classes for this division
           const classInserts = div.classes.map((cls, ci) => ({
             division_id: newDiv.id,
             name: cls.name,
             class_number: cls.classNumber || null,
             is_nan_qualifying: cls.isNanQualifying || false,
             sort_order: ci,
           }));
           
           await admin.from("event_classes").insert(classInserts);
         }
       }
     }
   }
   ```

### Edge Cases
- If template injection fails partway, the show is still created (just with fewer classes). This is acceptable — log the error but don't fail the show creation.
- Wrap template injection in try/catch with `logger.error()`.

### Validation Checklist
- [ ] The "Starting Template" dropdown appears in the Create Show form
- [ ] Selecting "Standard Halter" shows a description preview
- [ ] Create a new show using "Standard Halter" template
- [ ] Go to "Manage Classes" for the new show — 5 divisions and ~17 classes are pre-populated
- [ ] Create a show with "No template" — classes page is empty (as before)
- [ ] All 3 templates work correctly

---

## 🛑 HUMAN VERIFICATION GATE 2 🛑

**Stop execution. Await human input: "Phase 2 Verified. Proceed to Phase 3."**

- [ ] Create a new show using the "Standard Halter" template.
- [ ] Go to "Manage Classes". Did 17+ authentic NAMHSA classes instantly populate?

---

## Build Gate
Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
