// src/app/api/auth/[...auth]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getAccessToken, refreshAccessToken } from '@/lib/spotify'; 

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CALLBACK_PATH = '/api/auth/callback';

// Function to generate a secure random string for the state
const generateRandomString = (length: number) => {
  return crypto.randomBytes(length).toString('hex');
};

export async function GET(
  request: NextRequest,
  { params }: { params: { auth: string[] } }
) {
  const action = params.auth[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const redirectUri = new URL(SPOTIFY_CALLBACK_PATH, appUrl).toString();

  // === LOGIN ACTION ===
  if (action === 'login') {
    const state = generateRandomString(16);
    const scope = 'user-library-read user-top-read';

    // Set the state in a secure, httpOnly cookie
    cookies().set('spotify_auth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
      sameSite: 'lax', // Essential for OAuth redirects
    });

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
    }).toString();

    // Redirect the user to Spotify's authorization page
    return NextResponse.redirect(authUrl);
  }

  // === CALLBACK ACTION ===
  if (action === 'callback') {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    const cookieStore = cookies();
    const storedState = cookieStore.get('spotify_auth_state')?.value;

    // IMPORTANT: Clear the state cookie immediately after retrieving it
    cookieStore.delete('spotify_auth_state');

    // 1. Validate State: Ensure the state from Spotify matches our cookie
    if (!state || !storedState || state !== storedState) {
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', 'state_mismatch');
      return NextResponse.redirect(errorUrl);
    }

    if (!code) {
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', 'code_not_found');
      return NextResponse.redirect(errorUrl);
    }

    try {
      // 2. Exchange Authorization Code for Access Token
      const tokenData = await getAccessToken(code, redirectUri);
      const { access_token, refresh_token, expires_in } = tokenData;

      // 3. Set Final Session Cookies and Redirect
      // Redirect to the main page explicitly
      const response = NextResponse.redirect(new URL('/', request.url));
      
      response.cookies.set({
        name: 'spotify_access_token',
        value: access_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: expires_in,
        sameSite: 'lax',
      });

      if (refresh_token) {
        response.cookies.set({
          name: 'spotify_refresh_token',
          value: refresh_token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
        });
      }

      return response;

    } catch (error) {
      console.error("Spotify login failed:", error);
      const errorUrl = new URL('/', request.url);
      errorUrl.searchParams.set('error', 'spotify_login_failed');
      return NextResponse.redirect(errorUrl);
    }
  }

  // === LOGOUT ACTION ===
  if (action === 'logout') {
    cookies().delete('spotify_access_token');
    cookies().delete('spotify_refresh_token');
    return NextResponse.redirect(new URL('/', request.url));
  }


  // Fallback for any other /api/auth/* routes
  return NextResponse.redirect(new URL('/?error=invalid_auth_action', request.url));
}