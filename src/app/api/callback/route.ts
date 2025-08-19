import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAccessToken } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = cookies();
  const storedState = cookieStore.get('spotify_auth_state')?.value;

  if (state === null || state !== storedState) {
    return new NextResponse('State mismatch', { status: 400 });
  }

  cookieStore.delete('spotify_auth_state');

  if (!code) {
    return new NextResponse('Code not found', { status: 400 });
  }

  try {
    const redirect_uri = `${process.env.NEXT_PUBLIC_APP_URL}`;
    const tokenData = await getAccessToken(code, redirect_uri);

    const { access_token, refresh_token, expires_in } = tokenData;

    const response = NextResponse.redirect(new URL('/', request.url));
    
    response.cookies.set({
      name: 'spotify_access_token',
      value: access_token,
      httpOnly: true,
      path: '/',
      maxAge: expires_in, // in seconds
    });

    if (refresh_token) {
        response.cookies.set({
          name: 'spotify_refresh_token',
          value: refresh_token,
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
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
