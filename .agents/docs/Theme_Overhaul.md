# UI/UX Overhaul: "The Classic Tack Room" (De-AI Checklist)

**Role:** Expert UI/UX Frontend Developer
**Objective:** Model Horse Hub currently looks like a generic AI-generated crypto/SaaS dashboard (dark mode, neon purple gradients, glassmorphism, heavy emoji usage). We need to execute a complete aesthetic overhaul to a theme called "The Classic Tack Room." It should feel warm, heritage, premium, and equestrian. 

Please execute the following 4 phases sequentially. Do not skip any steps. Run `npm run build` after each phase to ensure no breakage.

### Phase 1: The Color Palette (Light Mode & Hunter Green)
**Target File:** `src/app/globals.css`

Replace the `:root` variables block with this new light/warm heritage palette. 
*CRITICAL:* Because we are moving from Dark Mode to Light Mode, you must search the rest of `globals.css` for any hardcoded `rgba(255, 255, 255, 0.x)` background or border colors (used heavily for glassmorphism) and replace them with `rgba(0, 0, 0, 0.05)` or `var(--color-border)` so they are actually visible on a light background.

```css
:root {
  /* Typography Variables */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-serif: var(--font-serif-theme, Georgia), 'Times New Roman', Times, serif;
  
  /* Font Sizes (Keep Existing) */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-md: 1.125rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  --font-size-3xl: 2.5rem;

  /* Backgrounds: Warm Cream / Soft Linen */
  --color-bg-primary: #FAF9F6;      /* Warm off-white/linen */
  --color-bg-secondary: #F3F0E6;    /* Slightly darker warm tone for contrast */
  --color-bg-card: #FFFFFF;         /* Crisp pure white */
  --color-bg-card-hover: #FDFBF7;   
  --color-bg-input: #FFFFFF;
  --color-bg-elevated: #FFFFFF;

  /* Use black-based alpha for glass/hover in light mode */
  --color-surface-glass: rgba(0, 0, 0, 0.03);
  --color-surface-glass-hover: rgba(0, 0, 0, 0.06);

  /* Text: High Contrast Charcoal & Slate (No harsh blacks) */
  --color-text-primary: #2D2926;    /* Espresso / Deep Charcoal */
  --color-text-secondary: #5C554D;  /* Warm dark gray */
  --color-text-muted: #8C8276;      /* Warm medium gray */
  --color-text-inverse: #FFFFFF;    /* White text for dark buttons */

  /* Accents — Hunter Green & Saddle Brown */
  --color-accent-primary: #2C5545;       /* Deep Hunter Green */
  --color-accent-primary-hover: #1E3D31; /* Darker Green */
  --color-accent-primary-glow: rgba(44, 85, 69, 0.15); 
  
  --color-accent-secondary: #8B5A2B;     /* Saddle Leather Brown */
  --color-accent-success: #356845;       /* Leaf Green */
  --color-accent-danger: #9B3028;        /* Brick Red */
  --color-accent-warning: #B8860B;       /* Antique Gold */

  /* Borders & Shadows — Soft and realistic */
  --color-border: #E6E2D8;               /* Warm light border */
  --color-border-focus: var(--color-accent-primary);
  --color-border-input: #D5D0C5;

  /* Shadows - No more glowing neon */
  --shadow-sm: 0 1px 2px rgba(45, 41, 38, 0.05);
  --shadow-md: 0 4px 6px rgba(45, 41, 38, 0.05), 0 1px 3px rgba(45, 41, 38, 0.08);
  --shadow-lg: 0 10px 15px rgba(45, 41, 38, 0.05), 0 4px 6px rgba(45, 41, 38, 0.04);
  --shadow-glow: 0 4px 12px rgba(44, 85, 69, 0.12); /* Subtle green shadow */

  /* Layout */
  --header-height: 64px;
  --max-width: 1200px;
  --btn-min-height: 44px;
  --font-scale: 1;
  --btn-min-h: var(--btn-min-height);
}
Phase 2: Typography (The "Two-Font Rule")
Target Files: src/app/layout.tsx and src/app/globals.css

We need to add a Serif font for headers to make it feel like a magazine, while keeping Inter for UI elements.

In layout.tsx: Import Playfair_Display from next/font/google alongside your existing Inter import.

Configure it: const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif-theme" });

Apply the variable to the <body> or <html> tag className.

In globals.css: Update the heading styles to use the new serif font.

Find the h1, h2, h3, h4, h5, h6 block. Add: font-family: var(--font-family-serif); and letter-spacing: -0.01em;.

Apply font-family: var(--font-family-serif); to .passport-title and .hero-headline as well.

Phase 3: Flatten the "Crypto" UI Elements
Target Files: src/app/globals.css, studio.css, and competition.css

We need to strip out the "Web3/Crypto" aesthetic.

Find .text-gradient: Remove the linear-gradient, -webkit-background-clip, and -webkit-text-fill-color. Change it to simply: color: var(--color-accent-primary);. We want solid, confident colors, not web3 gradients.

Remove backdrop-filter: blur(...): Find all instances across your CSS files and remove them. We want solid white cards resting on the cream background, not translucent glass.

Button Gradients: Update .btn-primary to use a solid color (background: var(--color-accent-primary);) instead of the purple-to-blue linear gradients. Change the hover state to use --color-accent-primary-hover with no heavy box-shadow.

Hero Glows: Find .hero-glow and .hero-glow-secondary and delete their CSS properties, or set display: none. We do not want floating gradient orbs in the background. Update .hero-section and .community-hero to have a solid background of var(--color-bg-secondary) with a 1px solid var(--color-border).

Phase 4: Exterminate the Emojis (Iconography Swap)
Target Files: package.json, src/components/*, src/app/*

The app currently uses emojis (🐴, 🏆, 📸, 🔒, 🎨) as icons. This looks cheap. We need to replace them with elegant, monochromatic line icons.

Install library: Run npm install lucide-react

Global Sweep: Search the codebase for UI emojis and replace them with imported Lucide icons. Use size={20} and strokeWidth={1.5} for a clean, delicate look. Focus on these highly-visible components first:

src/components/Header.tsx (The main desktop and mobile navigation links)

src/app/dashboard/page.tsx (The analytics metric cards: 🐴, 📁, 💰, 🏅)

src/app/page.tsx (The Landing Page Feature Cards and Hero)

src/components/StableGrid.tsx & ShowRingGrid.tsx (Empty states and badges)

src/components/HoofprintTimeline.tsx (Replace the EVENT_ICONS, STAGE_ICONS, etc., strings with actual rendered Lucide components).

Note: If a literal horse icon doesn't exist in Lucide, use conceptual equivalents (e.g., Camera for photos, Shield/Lock for the vault, Award/Ribbon for shows, Palette for art studio, BookOpen for reference). You may keep the horse emoji ONLY in the main top-left header logo for brand recognition.

Please execute these phases one by one. Check your build, and confirm when the UI has been successfully transformed!