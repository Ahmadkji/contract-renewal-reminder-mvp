import { NextResponse, type NextRequest } from "next/server";

function parseRequestId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().slice(0, 128);
  return normalized || null;
}

function getOrCreateRequestId(request: NextRequest): string {
  return parseRequestId(request.headers.get("x-request-id")) ?? crypto.randomUUID();
}

export function proxy(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers,
    },
  });

  response.headers.set("x-request-id", requestId);
  return response;
}
