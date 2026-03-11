import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rateLimit";

/**
 * POST /api/identify-mold
 *
 * "Answer Key" protocol:
 *   1. Query ALL valid mold names from catalog_items
 *   2. Inject them into the Gemini system prompt as the only allowed answers
 *   3. Call Gemini with temperature 0.0 for maximum determinism
 *   4. Return { manufacturer, mold_name, scale, confidence_score }
 *
 * Body: multipart/form-data with field "image" (JPEG / PNG / WebP).
 */

const GEMINI_PRIMARY = "gemini-3.1-pro-preview";
const GEMINI_FALLBACK = "gemini-2.5-flash";

const BASE_SYSTEM_PROMPT = `You are an expert equine model appraiser. Analyze this image to identify the specific physical Mold. Ignore the coat color. Output strictly in JSON format with keys: manufacturer, mold_name, scale, and confidence_score.`;

/** Build the full system prompt with the Answer Key injected. */
function buildSystemPrompt(validMoldNames: string[]): string {
  const list = validMoldNames.map((n) => `"${n}"`).join(", ");
  return `${BASE_SYSTEM_PROMPT}

CRITICAL CONSTRAINT — You MUST choose your answer from this exact list of valid Breyer molds: [${list}]. Do not output any mold_name not on this list. Match the capitalization exactly. If you cannot confidently match the image to any mold on this list, choose the closest match and set confidence_score below 0.5.`;
}

/** Call Gemini with a specific model. Returns the fetch Response. */
async function callGemini(
  model: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  try {
    // ── 0. Auth check ─────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Rate limit: 5 identifications per 24 hours per user
    const allowed = await checkRateLimit("identify_mold", 5, 1440, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Daily identification limit reached (5/day). Try again tomorrow." },
        { status: 429 }
      );
    }

    // ── 1. Validate API key ───────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    // ── 2. Parse multipart form-data ──────────────────────────────────
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided. Send as multipart 'image' field." },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${imageFile.type}. Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }

    // ── 3. Fetch the Answer Key from catalog_items ──────────────────
    const { data: moldRows, error: dbError } = await supabase
      .from("catalog_items")
      .select("title")
      .eq("item_type", "plastic_mold")
      .order("title");

    if (dbError) {
      console.error("Failed to fetch catalog_items:", dbError);
      return NextResponse.json(
        { error: "Could not load reference mold data." },
        { status: 500 }
      );
    }

    const validMoldNames = (moldRows ?? []).map(
      (r: { title: string }) => r.title
    );

    // ── 4. Convert image to base64 ────────────────────────────────────
    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const systemPrompt = buildSystemPrompt(validMoldNames);

    const geminiBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.0,
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [
            {
              text: "Identify the model horse mold in this image. Respond with JSON only.",
            },
            {
              inlineData: {
                mimeType: imageFile.type,
                data: base64Image,
              },
            },
          ],
        },
      ],
    };

    // ── 5. Call Gemini — primary model, fallback on 429 ───────────────
    let geminiRes = await callGemini(GEMINI_PRIMARY, apiKey, geminiBody);

    if (geminiRes.status === 429) {
      console.warn(
        `Gemini ${GEMINI_PRIMARY} rate-limited (429), falling back to ${GEMINI_FALLBACK}…`
      );
      geminiRes = await callGemini(GEMINI_FALLBACK, apiKey, geminiBody);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);

      if (geminiRes.status === 429) {
        return NextResponse.json(
          {
            error:
              "AI is temporarily rate-limited. Please wait ~30 seconds and try again.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Gemini API returned ${geminiRes.status}. Check server logs.` },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();

    // ── 6. Extract JSON from response ─────────────────────────────────
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: {
      manufacturer?: string;
      mold_name?: string;
      scale?: string;
      confidence_score?: number;
    };

    try {
      const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Gemini JSON:", rawText);
      return NextResponse.json(
        {
          error: "AI returned an unparseable response. Please try again.",
          raw: rawText,
        },
        { status: 422 }
      );
    }

    // ── 7. Validate against the answer key ────────────────────────────
    const moldName = parsed.mold_name ?? "Unknown";
    const isOnList = validMoldNames.some(
      (n) => n.toLowerCase() === moldName.toLowerCase()
    );

    const result = {
      manufacturer: parsed.manufacturer ?? "Breyer",
      mold_name: moldName,
      scale: parsed.scale ?? "Unknown",
      confidence_score:
        typeof parsed.confidence_score === "number"
          ? Math.round(parsed.confidence_score * 100) / 100
          : 0,
      on_answer_key: isOnList,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("identify-mold route error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
