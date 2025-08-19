import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const generateRandomString = (length: number) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const scope = 'user-library-read user-top-read';
const state = generateRandomString(16);

export function GET() {
  const cookieStore = cookies();
  cookieStore.set('spotify_auth_state', state, { 
    httpOnly: true, 
    path: '/',
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax'
  });

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: scope,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/callback`,
    state: state,
  }).toString();

  return NextResponse.redirect(authUrl);
}
