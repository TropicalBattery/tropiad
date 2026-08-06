import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getProfileForClient } from "@/lib/auth/profile";
import { isAllowedAppRole } from "@/lib/auth/roles";
import {
  getSingleCompanyDashboardPath,
  getSingleCompanySlug,
  isSingleCompanySlug,
} from "@/lib/config/single-company";
import type { Database } from "@/lib/supabase/types";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboard")
  );
}

function getDashboardSlug(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  return match?.[1] ?? null;
}

function singleCompanyDashboardUrl(request: NextRequest): URL {
  return new URL(getSingleCompanyDashboardPath(), request.url);
}

async function getRedirectForAuthenticatedUser(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient<Database, "ads">>,
  userId: string,
  email: string
): Promise<NextResponse | null> {
  const profile = await getProfileForClient(supabase, userId, email);
  const role = profile.role;
  const pathname = request.nextUrl.pathname;
  const dashboardHome = singleCompanyDashboardUrl(request);
  const allowed = isAllowedAppRole(role);

  if (pathname.startsWith("/login")) {
    if (allowed) {
      return NextResponse.redirect(dashboardHome);
    }
    return null;
  }

  if (!allowed) {
    if (isProtectedPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }
    return null;
  }

  // Admin home → Tropical Battery dashboard (clients list is dormant).
  if (pathname === "/admin") {
    return NextResponse.redirect(dashboardHome);
  }

  // /dashboard with no slug → single company.
  if (pathname === "/dashboard") {
    return NextResponse.redirect(dashboardHome);
  }

  // Any other company slug → pin to tropical-battery.
  const dashboardSlug = getDashboardSlug(pathname);
  if (dashboardSlug && !isSingleCompanySlug(dashboardSlug)) {
    const rest = pathname.slice(`/dashboard/${dashboardSlug}`.length);
    return NextResponse.redirect(
      new URL(`/dashboard/${getSingleCompanySlug()}${rest}`, request.url)
    );
  }

  return null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database, "ads">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "ads" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user?.email) {
    const redirect = await getRedirectForAuthenticatedUser(
      request,
      supabase,
      user.id,
      user.email
    );

    if (redirect) {
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/onboard",
    "/login",
  ],
};
