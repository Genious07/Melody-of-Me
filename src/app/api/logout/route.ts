import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export function GET(request: NextRequest) {
  const cookieStore = cookies();
  cookieStore.delete('spotify_access_token');
  cookieStore.delete('spotify_refresh_token');
  
  return NextResponse.redirect(new URL('/', request.url));
}
