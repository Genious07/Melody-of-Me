import { NextRequest, NextResponse } from 'next/server';

const generateRandomString = (length: number) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const scope = 'user-library-read user-top-read';

export function GET(request: NextRequest) {
  const state = generateRandomString(16);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: scope,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/callback`,
    state: state,
  }).toString();

  const response = NextResponse.redirect(authUrl);

  response.cookies.set({
    name: 'spotify_auth_state',
    value: state,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
  });

  return response;
}
