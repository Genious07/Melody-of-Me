
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllSavedTracks, refreshAccessToken } from '@/lib/spotify';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user.model';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value;

  if (!token) {
    return new NextResponse('User not authenticated', { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { spotifyId: string };
  } catch (error) {
    console.error("Invalid JWT:", error);
    const response = new NextResponse('Invalid session token.', { status: 401 });
    response.cookies.delete('session_token');
    return response;
  }

  await dbConnect();
  const user = await User.findOne({ spotifyId: decoded.spotifyId });

  if (!user) {
    return new NextResponse('User not found in database', { status: 404 });
  }

  let { accessToken, refreshToken } = user;

  try {
    const fetchWithRefresh = async <T>(fetcher: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await fetcher(accessToken);
      } catch (error) {
        if (!refreshToken) {
          throw new Error("Authentication expired. No refresh token available.");
        }
        const newTokens = await refreshAccessToken(refreshToken as string);
        accessToken = newTokens.access_token;
        await User.updateOne({ spotifyId: user.spotifyId }, { $set: { accessToken } });
        return await fetcher(accessToken);
      }
    };

    const savedTracks = await fetchWithRefresh(token => getAllSavedTracks(token));
    return NextResponse.json(savedTracks);
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
