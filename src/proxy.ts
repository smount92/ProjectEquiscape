import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: Do not add logic between createServerClient and
    // supabase.auth.getClaims(). A simple mistake could make it very hard to
    // debug issues with users being randomly logged out.

    // getClaims() validates the JWT locally using the project's public keys.
    // It never hits the Supabase auth server and never silently consumes a
    // refresh token — eliminating the root cause of "ghost logout" where a
    // token refresh in the old getUser() call would succeed but setAll on
    // the response would fail silently, leaving the session cookie stale.
    const { data, error } = await supabase.auth.getClaims();
    const user = !error && data?.claims ? { id: data.claims.sub as string } : null;

    // Public routes that do NOT require authentication
    const publicPaths = [
        "/login",
        "/signup",
        "/auth",
        "/forgot-password",
        "/getting-started",
        "/community",
        "/profile",
        "/discover",
        "/about",
        "/contact",
        "/claim",
        "/api",
        "/_next",
        "/favicon.ico",
        "/catalog",
        "/reference",
        "/market",
        "/show-ring",
        "/faq",
        "/privacy",
        "/terms",
        "/leaderboard",
        "/search",
        // Shows (Phase E2 cutover): /shows/[id] now serves the
        // anon-visible v2 public page (RLS 118 scopes reads to
        // non-draft shows) and /shows/host/[id]/ring/board is the
        // public announcer board — both need anon through. Every
        // OTHER page under /shows enforces its own server-side
        // login redirect (browse, the legacy detail body, host
        // console, judge queue, ring, planner), so opening the
        // subtree changes nothing for them.
        "/shows",
        // Card verification (Phase F): /cards/[code] is the public
        // "anyone can verify a card" trust page — anon must reach it.
        // Reads go through the anon-safe verify_qualification_card RPC.
        "/cards",
    ];

    const isPublicRoute =
        request.nextUrl.pathname === "/" ||
        publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

    // Protect all routes except public ones
    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except static files and images
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
