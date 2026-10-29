import { jsonRoute } from '@/lib/server/json-route';
import { catalog } from '@/lib/server/water';

export const dynamic = 'force-dynamic';

/** GET /api/water/catalog — station and item reference codes. */
export function GET() {
  return jsonRoute(() => catalog());
}
