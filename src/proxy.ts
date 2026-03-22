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
        "/market",
        "/show-ring",
        "/faq",
        "/privacy",
        "/terms",
        "/leaderboard",
        "/search",
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
