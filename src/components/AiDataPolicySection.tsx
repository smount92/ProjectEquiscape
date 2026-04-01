export default function AiDataPolicySection() {
 return (
 <section className="mb-12" id="ai-data-policy">
 <h2>🤖 AI, Data Collection, and Copyright Policy</h2>
 <p className="mb-6 text-base leading-relaxed text-stone-600">
  We believe your data and your art belong to you. Because there is a lot of confusion
  regarding how modern websites are built, we want to be fully transparent about our
  technology and data practices:
 </p>

 <div className="flex flex-col gap-6">
  {/* Q1 */}
  <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
  <h3 className="mb-2 text-base font-bold text-stone-900">
   1. Are my photos used to train AI?
  </h3>
  <p className="text-base leading-relaxed text-stone-600">
   <strong>Absolutely not.</strong> Model Horse Hub does not use user-uploaded images,
   descriptions, or custom artwork to train any Generative Artificial Intelligence models.
   We do not sell or share our database with third-party AI companies. Your photos and art
   remain your exclusive intellectual property.
  </p>
  </div>

  {/* Q2 */}
  <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
  <h3 className="mb-2 text-base font-bold text-stone-900">
   2. Did you use AI to scrape other hobby websites?
  </h3>
  <p className="text-base leading-relaxed text-stone-600">
   <strong>No.</strong> Our reference catalog of 10,500+ models was built using
   traditional, standard data-gathering scripts, not AI scrapers.
  </p>
  </div>

  {/* Q3 */}
  <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
  <h3 className="mb-2 text-base font-bold text-stone-900">
   3. How did you gather the reference data ethically?
  </h3>
  <p className="mb-4 text-base leading-relaxed text-stone-600">
   We took strict measures to ensure our data collection was ethical, legal, and respectful
   of the hobby ecosystem:
  </p>
  <ul className="flex flex-col gap-3 p-0">
   <li className="flex items-start gap-3 text-base leading-relaxed text-stone-600">
   <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">📋</span>
   <span>
    <strong>Non-Copyrightable Facts Only:</strong> We only indexed publicly available,
    factual data (e.g., manufacturer names, release years, scales, and mold names).
    Facts cannot be copyrighted. We did not scrape original articles, artist
    biographies, or opinion pieces.
   </span>
   </li>
   <li className="flex items-start gap-3 text-base leading-relaxed text-stone-600">
   <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">🚫</span>
   <span>
    <strong>Zero Photos Scraped:</strong> We explicitly excluded all images from our
    data gathering to protect the copyright of hobby photographers and artists. Every
    reference photo on MHH has been uploaded by a community member who owns that
    specific model.
   </span>
   </li>
   <li className="flex items-start gap-3 text-base leading-relaxed text-stone-600">
   <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">🐢</span>
   <span>
    <strong>Server Respect (Rate-Limiting):</strong> We know that legacy hobby
    reference websites are often run by volunteers on tight budgets. We heavily
    rate-limited our scripts to run slowly, ensuring we never consumed excess
    bandwidth, wore down, or burdened their servers.
   </span>
   </li>
  </ul>
  </div>

  {/* Q4 */}
  <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
  <h3 className="mb-2 text-base font-bold text-stone-900">
   4. Where is AI actually used on the platform?
  </h3>
  <p className="mb-4 text-base leading-relaxed text-stone-600">
   AI is utilized exclusively as a backend utility to save time:
  </p>
  <ul className="flex flex-col gap-3 p-0">
   <li className="flex items-start gap-3 text-base leading-relaxed text-stone-600">
   <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">💻</span>
   <span>
    <strong>Writing Code:</strong> We utilized AI coding assistants to help our human
    developers architect the database and write portions of the platform&apos;s code
    securely and efficiently.
   </span>
   </li>
   <li className="flex items-start gap-3 text-base leading-relaxed text-stone-600">
   <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">📊</span>
   <span>
    <strong>Data Summarization (Pro Feature):</strong> Premium users receive an
    automated monthly email summarizing their collection&apos;s market value changes.
    This feature uses a secure Enterprise text-generation API purely as a calculator to
    turn numerical data into a readable text summary. It does not look at, scan, or
    analyze your photographs.
   </span>
   </li>
  </ul>
  </div>
 </div>
 </section>
 );
}
