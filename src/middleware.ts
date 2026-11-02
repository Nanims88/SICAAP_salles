import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtre rapide : sans cookie de session, redirection vers /login.
 * La validité réelle de la session est vérifiée côté serveur (requireUser).
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.has("sicaap_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|logo|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
