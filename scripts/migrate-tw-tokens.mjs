/**
 * Tailwind v4 Token Migration Script
 *
 * Fixes broken utility class names across all TSX files by:
 * 1. Renaming color tokens from nested namespaces to flat semantic names
 * 2. Converting named spacing (gap-lg, p-md) to numeric spacing (gap-6, p-4)
 *
 * Run: node scripts/migrate-tw-tokens.mjs
 */
import fs from 'fs';
import path from 'path';

// ─── Color token renames ──────────────────────────────────────────────────────
// Old broken class → New working class
const COLOR_MAP = [
  // Backgrounds
  ['bg-bg-card',           'bg-card'],
  ['bg-bg-elevated',       'bg-elevated'],
  ['bg-bg-input',          'bg-input'],
  ['bg-bg-primary',        'bg-parchment'],
  ['bg-bg-secondary',      'bg-parchment-dark'],
  ['bg-accent-primary',    'bg-forest'],
  ['bg-accent-secondary',  'bg-saddle'],
  ['bg-accent-danger',     'bg-danger'],
  ['bg-accent-success',    'bg-success'],
  ['bg-accent-warning',    'bg-warning'],

  // Text colors
  ['text-text-muted',      'text-muted'],
  ['text-text-primary',    'text-ink'],
  ['text-text-secondary',  'text-ink-light'],
  ['text-text-inverse',    'text-inverse'],
  ['text-accent-primary',  'text-forest'],
  ['text-accent-secondary','text-saddle'],
  ['text-accent-danger',   'text-danger'],
  ['text-accent-success',  'text-success'],
  ['text-accent-warning',  'text-warning'],

  // Border colors
  ['border-border',        'border-edge'],
  ['border-border-focus',  'border-edge-focus'],
  ['border-border-input',  'border-edge-input'],
  ['border-accent-primary','border-forest'],

  // Hover variants — same renames
  ['hover:border-accent-primary','hover:border-forest'],
  ['hover:text-accent-primary',  'hover:text-forest'],
  ['hover:text-accent-secondary','hover:text-saddle'],
  ['hover:text-text-primary',    'hover:text-ink'],
  ['hover:bg-accent-primary',    'hover:bg-forest'],
  ['hover:bg-bg-card-hover',     'hover:bg-card-hover'],
];

// ─── Spacing token conversions ────────────────────────────────────────────────
// Named spacing → numeric (based on --spacing: 0.25rem multiplier)
// xs=0.25rem=1, sm=0.5rem=2, md=1rem=4, lg=1.5rem=6, xl=2rem=8, 2xl=3rem=12, 3xl=4rem=16
const SPACING_MAP = {
  'xs': '1',
  'sm': '2',
  'md': '4',
  'lg': '6',
  'xl': '8',
  '2xl': '12',
  '3xl': '16',
};

// Spacing utility prefixes that need conversion
const SPACING_PREFIXES = [
  'gap', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr',
  'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr',
];

// Build spacing replacements
const SPACING_REPLACEMENTS = [];
for (const prefix of SPACING_PREFIXES) {
  for (const [name, num] of Object.entries(SPACING_MAP)) {
    SPACING_REPLACEMENTS.push([`${prefix}-${name}`, `${prefix}-${num}`]);
  }
}

// Also handle responsive/hover prefix variants
const RESPONSIVE_PREFIXES = ['max-lg:', 'sm:', 'md:', 'lg:', 'xl:', '2xl:'];
for (const rp of RESPONSIVE_PREFIXES) {
  for (const prefix of SPACING_PREFIXES) {
    for (const [name, num] of Object.entries(SPACING_MAP)) {
      SPACING_REPLACEMENTS.push([`${rp}${prefix}-${name}`, `${rp}${prefix}-${num}`]);
    }
  }
}

// Also add duration-base → duration-250 (transition)
const MISC_REPLACEMENTS = [
  ['duration-base', 'duration-250'],
];

// Combine all replacements, sort by length desc to prevent partial matches
const ALL_REPLACEMENTS = [...COLOR_MAP, ...SPACING_REPLACEMENTS, ...MISC_REPLACEMENTS]
  .sort((a, b) => b[0].length - a[0].length);

function migrateFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  const original = content;
  let changes = 0;

  for (const [from, to] of ALL_REPLACEMENTS) {
    // Word-boundary-aware: preceded by space/" / ' / ` / { and followed by same or end
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(?<=[\\s"'\`{])${escaped}(?=[\\s"'\`}])`,
      'g'
    );
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, to);
      changes += matches.length;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
    const rel = path.relative(process.cwd(), filepath);
    console.log(`  ✅ ${rel} — ${changes} replacements`);
    return changes;
  }
  return 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function findTsx(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTsx(full));
    else if (entry.name.endsWith('.tsx')) results.push(full);
  }
  return results;
}

const files = findTsx('src');
let totalChanges = 0;
let totalFiles = 0;

console.log('🔄 Migrating Tailwind utility tokens...\n');
console.log('   Color: nested → flat semantic names');
console.log('   Spacing: named (gap-lg) → numeric (gap-6)');
console.log('');

for (const f of files) {
  const n = migrateFile(f);
  if (n > 0) {
    totalFiles++;
    totalChanges += n;
  }
}

console.log(`\n✅ Done: ${totalChanges} replacements across ${totalFiles} files`);
