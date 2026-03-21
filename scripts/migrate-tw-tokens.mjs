/**
 * Tailwind v4 Token Migration Script — Pass 2
 *
 * Handles all prefixes including !, responsive, hover:, group-hover:, 
 * placeholder:, arbitrary variants [&_p]:, etc.
 *
 * Run: node scripts/migrate-tw-tokens.mjs
 */
import fs from 'fs';
import path from 'path';

// ─── All token replacements (bare class → bare class) ─────────────────────
// The regex engine will handle ALL prefix variants automatically
const REPLACEMENTS = [
  // === COLORS ===
  // Background colors
  ['bg-bg-card',            'bg-card'],
  ['bg-bg-elevated',        'bg-elevated'],
  ['bg-bg-input',           'bg-input'],
  ['bg-bg-primary',         'bg-parchment'],
  ['bg-bg-secondary',       'bg-parchment-dark'],
  ['bg-bg-card-hover',      'bg-card-hover'],
  ['bg-accent-primary',     'bg-forest'],
  ['bg-accent-secondary',   'bg-saddle'],
  ['bg-accent-danger',      'bg-danger'],
  ['bg-accent-success',     'bg-success'],
  ['bg-accent-warning',     'bg-warning'],

  // Text colors
  ['text-text-muted',       'text-muted'],
  ['text-text-primary',     'text-ink'],
  ['text-text-secondary',   'text-ink-light'],
  ['text-text-inverse',     'text-inverse'],
  ['text-accent-primary',   'text-forest'],
  ['text-accent-secondary', 'text-saddle'],
  ['text-accent-danger',    'text-danger'],
  ['text-accent-success',   'text-success'],
  ['text-accent-warning',   'text-warning'],

  // Border colors
  ['border-border',         'border-edge'],
  ['border-border-focus',   'border-edge-focus'],
  ['border-border-input',   'border-edge-input'],
  ['border-accent-primary', 'border-forest'],
  ['border-accent-success', 'border-success'],
  ['border-accent-danger',  'border-danger'],
  ['border-accent-warning', 'border-warning'],

  // === SPACING ===
  // Format: prefix-NAME → prefix-NUMBER
  // xs=1, sm=2, md=4, lg=6, xl=8, 2xl=12, 3xl=16
];

// Spacing names → numeric
const SPACING_MAP = {
  'xs': '1', 'sm': '2', 'md': '4', 'lg': '6',
  'xl': '8', '2xl': '12', '3xl': '16',
};

// ALL utility prefixes that take spacing values
const SPACING_UTILITIES = [
  'gap', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'ms', 'me',
  'top', 'right', 'bottom', 'left',
  'inset', 'inset-x', 'inset-y',
  'w', 'h', 'size',
  'min-w', 'min-h', 'max-w', 'max-h',
  'space-x', 'space-y',
  'scroll-m', 'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mb', 'scroll-ml', 'scroll-mr',
  'scroll-p', 'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pb', 'scroll-pl', 'scroll-pr',
];

for (const util of SPACING_UTILITIES) {
  for (const [name, num] of Object.entries(SPACING_MAP)) {
    REPLACEMENTS.push([`${util}-${name}`, `${util}-${num}`]);
  }
}

// Misc
REPLACEMENTS.push(['duration-base', 'duration-250']);

// Sort by length descending to prevent partial matches
REPLACEMENTS.sort((a, b) => b[0].length - a[0].length);

function migrateFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  const original = content;
  let changes = 0;

  for (const [from, to] of REPLACEMENTS) {
    // Escape for regex
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match the bare class with ANY number of prefix modifiers like:
    // hover:, focus:, group-hover:, max-lg:, sm:, [&_p]:, placeholder:, !, etc.
    // The class can be preceded by: space, ", ', `, {, or start of line
    // And followed by: space, ", ', `, }, or end of line
    //
    // This regex matches:
    //   hover:bg-accent-primary
    //   !bg-accent-primary
    //   [&_p]:text-text-secondary
    //   group-hover:text-accent-primary
    //   hover:!border-accent-primary
    //   max-lg:gap-lg
    //   placeholder:text-text-muted
    //   [&_p:first-child]:text-text-primary
    //
    // We match the BARE part only and preserve any prefix
    const regex = new RegExp(
      `(?<=[\\s"'\`{:!])${esc}(?=[\\s"'\`}])`,
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

console.log('🔄 Pass 2: Migrating remaining Tailwind tokens...\n');
console.log('   Handles !, hover:, group-hover:, [&_p]:, placeholder:, etc.');
console.log('   Also covers top/right/bottom/left/inset spacing');
console.log('');

for (const f of files) {
  const n = migrateFile(f);
  if (n > 0) {
    totalFiles++;
    totalChanges += n;
  }
}

console.log(`\n✅ Done: ${totalChanges} replacements across ${totalFiles} files`);
