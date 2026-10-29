import { NextResponse } from 'next/server';
import { ApiError } from './api-error.ts';

/** Run `produce` and render either its value or an ApiError as JSON. */
export async function jsonRoute<T>(produce: () => Promise<T> | T) {
  try {
    return NextResponse.json(await produce(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    return NextResponse.json(
      { detail: '요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.' },
      { status: 500 },
    );
  }
}
