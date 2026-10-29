import type { NextRequest } from 'next/server';
import { jsonRoute } from '@/lib/server/json-route';
import { current } from '@/lib/server/kma';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** GET /api/weather?lat&lon — current KMA observation near a coordinate. */
export function GET(request: NextRequest) {
  return jsonRoute(() => current(request.nextUrl.searchParams));
}
