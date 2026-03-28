import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Silently handle probe requests from external tools (MCP clients, extensions)
  if (path.startsWith("/.well-known/") || path === "/mcp") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/.well-known/:path*", "/mcp"],
};
