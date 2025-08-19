import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAccessToken } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = cookies();
  const storedState = cookieStore.get('spotify_auth_state')?.value;

  // Immediately clear the state cookie after reading it
  cookieStore.delete('spotify_auth_state');

  if (state === null || state !== storedState) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'state_mismatch');
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'code_not_found');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const redirect_uri = `${process.env.NEXT_PUBLIC_APP_URL}/api/callback`;
    const tokenData = await getAccessToken(code, redirect_uri);

    const { access_token, refresh_token, expires_in } = tokenData;

    const response = NextResponse.redirect(new URL('/', request.url));
    
    response.cookies.set({
      name: 'spotify_access_token',
      value: access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      maxAge: expires_in,
      sameSite: 'lax',
    });

    if (refresh_token) {
        response.cookies.set({
          name: 'spotify_refresh_token',
          value: refresh_token,
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
        });
    }

    return response;

  } catch (error) {
    console.error(error);
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('error', 'spotify_login_failed')
    return NextResponse.redirect(redirectUrl);
  }
}
