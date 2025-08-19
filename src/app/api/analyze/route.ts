import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllSavedTracks, refreshAccessToken } from '@/lib/spotify';
import { analyzeMusicalEras } from '@/lib/analysis'; // Import the new service
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
    const fetchWithRefresh = async <T>(fetcher: (token: string) => Promise<T>): Promise<{data: T, token: string}> => {
      try {
        const data = await fetcher(accessToken);
        return { data, token: accessToken };
      } catch (error) {
        console.log("Access token likely expired, attempting refresh.");
        if (!refreshToken) {
          throw new Error("Authentication expired. No refresh token available.");
        }
        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;
        await User.updateOne({ spotifyId: user.spotifyId }, { $set: { accessToken } });
        const data = await fetcher(accessToken);
        return { data, token: accessToken };
      }
    };

    // 1. Fetch all saved tracks
    const { data: savedTracks, token: currentAccessToken } = await fetchWithRefresh(token => getAllSavedTracks(token));

    // If user has too few tracks, return empty to prevent errors
    if (!savedTracks || savedTracks.length < 20) {
        return NextResponse.json([]);
    }

    // 2. Analyze the tracks to identify eras, passing the most current tokens
    const eras = await analyzeMusicalEras(user.spotifyId, savedTracks, currentAccessToken, refreshToken);

    return NextResponse.json(eras);

  } catch (error: any) {
    console.error("Analysis failed:", error);
    let errorMessage = 'Failed to analyze music data.';
    let status = 500;
    
    if (error.message.includes("Authentication expired")) {
        errorMessage = error.message;
        status = 401;
        const errResponse = new NextResponse(JSON.stringify({ error: errorMessage }), { status });
        errResponse.cookies.delete('session_token');
        return errResponse;
    }
    return new NextResponse(JSON.stringify({ error: errorMessage, details: error.message }), { status });
  }
}
