import type { NextRequest } from 'next/server';
import { jsonRoute } from '@/lib/server/json-route';
import { summary } from '@/lib/server/water';

export const dynamic = 'force-dynamic';
// Paging across every station for a day is the slowest call in the app; the
// query itself gives up at 50s so it can report a usable error first.
export const maxDuration = 60;

/** GET /api/water/summary — item average for a day across the selected stations. */
export function GET(request: NextRequest) {
  return jsonRoute(() => summary(request.nextUrl.searchParams));
}
