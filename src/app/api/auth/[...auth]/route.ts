// src/app/api/auth/[...auth]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getAccessToken, getUserProfile, refreshAccessToken } from '@/lib/spotify';
import User from '@/models/user.model';
import dbConnect from '@/lib/dbConnect';
import jwt from 'jsonwebtoken';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CALLBACK_PATH = '/api/auth/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Function to generate a secure random string for the state
const generateRandomString = (length: number) => {
  return crypto.randomBytes(length).toString('hex');
};

export async function GET(
  request: NextRequest,
  { params }: { params: { auth: string[] } }
) {
  const action = params.auth[0];

  // Dynamically construct the redirect URI from the request
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const appUrl = `${proto}://${host}`;
  const redirectUri = new URL(SPOTIFY_CALLBACK_PATH, appUrl).toString();

  // === LOGIN ACTION ===
  if (action === 'login') {
    const state = generateRandomString(16);
    const scope = 'user-library-read user-top-read user-read-private user-read-email playlist-read-private playlist-read-collaborative';

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
      // Ensure DB connection
      await dbConnect();

      // 2. Exchange Authorization Code for Access Token
      const tokenData = await getAccessToken(code, redirectUri);
      const { access_token, refresh_token } = tokenData;

      // 3. Fetch user profile from Spotify
      const userProfile = await getUserProfile(access_token);

      // 4. Upsert user data into MongoDB
      await User.updateOne(
        { spotifyId: userProfile.id },
        {
          $set: {
            displayName: userProfile.display_name,
            email: userProfile.email,
            accessToken: access_token,
            refreshToken: refresh_token || undefined, // Only set if provided
            lastLogin: new Date(),
          },
        },
        { upsert: true }
      );

      // 5. Create a session JWT and set it as a cookie
      const token = jwt.sign({ spotifyId: userProfile.id }, JWT_SECRET, {
        expiresIn: '30d',
      });

      const response = NextResponse.redirect(new URL('/dashboard', request.url));

      response.cookies.set({
        name: 'session_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
      });

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
    cookies().delete('session_token');
    return NextResponse.redirect(new URL('/', request.url));
  }


  // Fallback for any other /api/auth/* routes
  return NextResponse.redirect(new URL('/?error=invalid_auth_action', request.url));
}