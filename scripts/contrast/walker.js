/**
 * Contrast walker — every visible piece of text on the page, measured.
 *
 * Runs INSIDE the page. Two ways in:
 *   1. Paste this whole file into the browser console on any page of the
 *      site (logged in, any theme, real data), then run
 *          __mhhContrast({ highlight: true })
 *      Failures get a red outline and a console table; the return value
 *      is the full report.
 *   2. e2e/contrast.spec.ts injects it and runs every route in every
 *      theme (npm run test:contrast).
 *
 * What it measures: for each text node, the computed text colour against
 * the first opaque background found walking up the tree (translucent
 * layers are composited on the way). WCAG 2.1 AA: 4.5:1 for normal text,
 * 3:1 for large text (>= 24px, or >= 18.66px bold). Placeholders are
 * measured too. Disabled controls are exempt, as in WCAG.
 *
 * What it cannot measure: text sitting on a gradient or an image
 * (leather, wood, brass, photos). Those rows are reported as
 * `unverified` with the nearest flat colour as an estimate, so the
 * count is visible but they never fail the run on their own.
 */
(function () {
    function alphaOf(v) {
        if (v === undefined || v === "") return 1;
        return v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
    }
    function gamma(c) {
        c = Math.min(1, Math.max(0, c));
        return (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
    }
    /** OKLab → sRGB (Björn Ottosson's matrices). */
    function oklabToRgb(L, A, B, a) {
        const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
        const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
        const s_ = L - 0.0894841775 * A - 1.291485548 * B;
        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;
        return {
            r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
            a,
        };
    }
    /**
     * Any computed colour Chromium hands back: rgb()/rgba(), and the
     * modern forms Tailwind's colour-mix produces — oklab(), oklch(),
     * color(srgb …). Percent lightness/alpha are accepted.
     */
    function parseColor(str) {
        if (!str) return null;
        str = str.trim();
        let m = str.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
        if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]) };
        m = str.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
        if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: alphaOf(m[4]) };
        m = str.match(/^oklab\(\s*([\d.]+%?)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
        if (m) {
            const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
            return oklabToRgb(L, +m[2], +m[3], alphaOf(m[4]));
        }
        m = str.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+(-?[\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
        if (m) {
            const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
            const C = +m[2];
            const h = (+m[3] * Math.PI) / 180;
            return oklabToRgb(L, C * Math.cos(h), C * Math.sin(h), alphaOf(m[4]));
        }
        // last resort: let the engine normalise a keyword or hex
        const viaProbe = toRgb(str);
        if (viaProbe && viaProbe !== str) return parseColor(viaProbe);
        return null;
    }
    function over(top, bottom) {
        // Porter-Duff "over": top composited on an opaque bottom.
        const a = top.a;
        return {
            r: top.r * a + bottom.r * (1 - a),
            g: top.g * a + bottom.g * (1 - a),
            b: top.b * a + bottom.b * (1 - a),
            a: 1,
        };
    }
    function luminance(c) {
        const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function ratio(a, b) {
        const l1 = luminance(a);
        const l2 = luminance(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function hex(c) {
        const h = (v) => Math.round(v).toString(16).padStart(2, "0");
        return "#" + h(c.r) + h(c.g) + h(c.b);
    }
    function isHidden(el) {
        for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return true;
            if (cs.contentVisibility === "hidden") return true;
            if (e.hasAttribute("hidden")) return true;
            // the body of a closed <details> is not shown (and Chromium skips
            // its style recalc, so its colours would be stale anyway)
            if (e.tagName === "DETAILS" && !e.open && el !== e) {
                const summary = e.querySelector(":scope > summary");
                if (!summary || !summary.contains(el)) return true;
            }
        }
        return false;
    }
    function pathOf(el) {
        const parts = [];
        for (let e = el, n = 0; e && e.nodeType === 1 && n < 5; e = e.parentElement, n++) {
            let s = e.tagName.toLowerCase();
            if (e.id) s += "#" + e.id;
            else if (e.dataset && e.dataset.testid) s += "[data-testid=" + e.dataset.testid + "]";
            else if (e.classList.length) s += "." + Array.from(e.classList).slice(0, 3).join(".");
            parts.unshift(s);
        }
        return parts.join(" > ");
    }
    /**
     * A textured surface whose base colour we know: the material ramps
     * are flat tokens under the grain. Returns the token colour so text
     * on leather/wood/brass is measured against its real ground instead
     * of being written off as unverifiable.
     */
    function materialBase(el) {
        const cl = el.classList;
        const root = getComputedStyle(document.documentElement);
        const tok = (name) => parseColor(toRgb(root.getPropertyValue(name).trim()));
        if (cl.contains("wood-panel") || cl.contains("wood")) return tok("--wood");
        if (cl.contains("brass-plaque") || cl.contains("brass-ring")) return tok("--brass");
        for (const c of cl) if (c.startsWith("leather")) return tok("--leather");
        return null;
    }
    const probe = document.createElement("span");
    function toRgb(css) {
        if (!css) return "";
        if (css.startsWith("rgb")) return css;
        probe.style.color = "";
        probe.style.color = css;
        if (!probe.style.color) return "";
        document.documentElement.appendChild(probe);
        const out = getComputedStyle(probe).color;
        probe.remove();
        return out;
    }
    /**
     * The bottom paint layer of a background-image, when it is a plain
     * gradient between opaque stops (the ledger paper, the night page
     * wash). Returns the stops so text can be measured against the worst
     * of them; null for photos, noise textures, or translucent scrims.
     */
    function lastGradientStops(bgImage) {
        if (!bgImage || bgImage === "none") return null;
        const idx = bgImage.lastIndexOf("gradient(");
        if (idx < 0) return null;
        let depth = 0;
        let end = -1;
        for (let i = bgImage.indexOf("(", idx); i < bgImage.length; i++) {
            const ch = bgImage[i];
            if (ch === "(") depth++;
            else if (ch === ")") {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end < 0) return null;
        // a url() image underneath the gradient is the real ground, not the gradient
        if (bgImage.indexOf("url(", end) !== -1) return null;
        const body = bgImage.slice(idx, end + 1);
        if (/\btransparent\b/.test(body)) return null;
        const cols = body.match(/(rgba?|oklab|oklch|color)\([^()]*\)/g) || [];
        const stops = cols.map(parseColor).filter(Boolean);
        if (stops.length < 2 || stops.some((c) => c.a < 1)) return null;
        return stops;
    }
    /**
     * The effective background under `el`: composite translucent layers
     * upward until an opaque one. When the opaque ground is a gradient,
     * `grounds` carries one composite per stop so the caller can take the
     * worst case; otherwise it holds the single ground.
     */
    function backgroundOf(el) {
        const layers = [];
        let imageAt = null;
        let bases = null;
        for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
            const cs = getComputedStyle(e);
            const bg = parseColor(cs.backgroundColor);
            const img = cs.backgroundImage && cs.backgroundImage !== "none";
            if (bg && bg.a > 0) layers.push(bg);
            if (bg && bg.a >= 1) break;
            if (img) {
                const base = materialBase(e);
                if (base) {
                    bases = [base]; // known material: measurable
                    break;
                }
                const stops = lastGradientStops(cs.backgroundImage);
                if (stops) {
                    bases = stops; // plain gradient: measurable against every stop
                    break;
                }
                imageAt = e; // a photo or an unknown paint: estimate only
                break;
            }
        }
        // canvas default: whatever the html/body resolved to, else white
        if (!bases) {
            let acc = { r: 255, g: 255, b: 255, a: 1 };
            const last = layers[layers.length - 1];
            if (!last || last.a < 1) {
                const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
                const htmlBg = parseColor(getComputedStyle(document.documentElement).backgroundColor);
                const base = (htmlBg && htmlBg.a > 0 ? htmlBg : null) || (bodyBg && bodyBg.a > 0 ? bodyBg : null);
                if (base) acc = over(base, acc);
            }
            bases = [acc];
        }
        const grounds = bases.map((base) => {
            let acc = base.a < 1 ? over(base, { r: 255, g: 255, b: 255, a: 1 }) : base;
            for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
            return acc;
        });
        return { grounds, imageAt };
    }
    function isLarge(cs) {
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || (cs.fontWeight === "bold" ? 700 : 400);
        return size >= 24 || (size >= 18.66 && weight >= 700);
    }
    function measure(el, textColorStr, sample, kind) {
        const fg0 = parseColor(textColorStr);
        if (!fg0) return null;
        const { grounds, imageAt } = backgroundOf(el);
        // worst case across a gradient's stops
        let bg = grounds[0];
        let fg = fg0.a < 1 ? over(fg0, bg) : fg0;
        let r = ratio(fg, bg);
        for (let i = 1; i < grounds.length; i++) {
            const f = fg0.a < 1 ? over(fg0, grounds[i]) : fg0;
            const rr = ratio(f, grounds[i]);
            if (rr < r) {
                r = rr;
                bg = grounds[i];
                fg = f;
            }
        }
        const cs = getComputedStyle(el);
        const required = isLarge(cs) ? 3 : 4.5;
        return {
            kind,
            text: sample.replace(/\s+/g, " ").trim().slice(0, 60),
            path: pathOf(el),
            fg: hex(fg),
            bg: hex(bg),
            ratio: Math.round(r * 100) / 100,
            required,
            size: Math.round(parseFloat(cs.fontSize) * 10) / 10,
            weight: cs.fontWeight,
            unverified: !!imageAt,
            imageOn: imageAt ? pathOf(imageAt) : null,
            pass: r >= required,
        };
    }

    /** A text node that is only emoji / pictographs (plus joiners and whitespace). */
    const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}⃣️‍\s]+$/u;

    window.__mhhContrast = function (opts) {
        opts = opts || {};
        const root = opts.root || document.body;
        const seen = new Set();
        const rows = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                // emoji carry their own colours; `color` does not paint them
                if (EMOJI_ONLY.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
                const el = node.parentElement;
                if (!el) return NodeFilter.FILTER_REJECT;
                const tag = el.tagName;
                if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE" || tag === "TITLE") return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        let node;
        while ((node = walker.nextNode())) {
            const el = node.parentElement;
            if (isHidden(el)) continue;
            if (el.closest("[disabled], :disabled, [aria-disabled=true]")) continue;
            // a one- or two-character glyph the page itself marks decorative (an icon), not text
            if (node.nodeValue.trim().length <= 2 && el.closest('[aria-hidden="true"]')) continue;
            const rect = el.getBoundingClientRect();
            // nothing to see: collapsed, or visually hidden (sr-only is a 1px clipped box)
            if (rect.width <= 1 || rect.height <= 1) continue;
            const cs = getComputedStyle(el);
            if (cs.fontSize && parseFloat(cs.fontSize) < 1) continue;
            const key = pathOf(el) + "|" + cs.color + "|" + node.nodeValue.trim().slice(0, 20);
            if (seen.has(key)) continue;
            seen.add(key);
            const row = measure(el, cs.color, node.nodeValue, "text");
            if (row) {
                row.el = el;
                rows.push(row);
            }
        }
        // Placeholders: what an empty field says.
        for (const el of root.querySelectorAll("input[placeholder], textarea[placeholder]")) {
            if (isHidden(el) || el.disabled || el.value) continue;
            let pc;
            try {
                pc = getComputedStyle(el, "::placeholder").color;
            } catch {
                pc = null;
            }
            if (!pc) continue;
            const row = measure(el, pc, el.getAttribute("placeholder") || "", "placeholder");
            if (row) {
                row.el = el;
                rows.push(row);
            }
        }
        const failures = rows.filter((r) => !r.pass && !r.unverified);
        const unverified = rows.filter((r) => r.unverified && !r.pass);
        if (opts.highlight) {
            for (const r of failures) {
                r.el.style.outline = "3px solid #ff0040";
                r.el.style.outlineOffset = "1px";
                r.el.title = "Contrast " + r.ratio + ":1 (needs " + r.required + ") " + r.fg + " on " + r.bg;
            }
        }
        const strip = (r) => {
            const o = Object.assign({}, r);
            delete o.el;
            return o;
        };
        const report = {
            url: location.pathname + location.search,
            theme: document.documentElement.getAttribute("data-theme") || "day",
            simple: document.documentElement.getAttribute("data-simple-mode") === "true",
            measured: rows.length,
            failures: failures.map(strip),
            unverified: unverified.map(strip),
        };
        if (!opts.quiet && typeof console !== "undefined") {
            console.log("[contrast] " + report.url + " (" + report.theme + (report.simple ? ", simple" : "") + "): " + rows.length + " measured, " + failures.length + " failing, " + unverified.length + " unverifiable (on image/gradient)");
            if (failures.length && console.table) console.table(failures.map((r) => ({ ratio: r.ratio, needs: r.required, fg: r.fg, bg: r.bg, text: r.text, where: r.path })));
        }
        return report;
    };
})();
