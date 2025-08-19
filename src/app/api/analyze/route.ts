// src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getUserProfile,
  getTopItems,
  getAllSavedTracks,
  getUserPlaylists,
  refreshAccessToken,
} from '@/lib/spotify';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user.model';
import jwt from 'jsonwebtoken';
import { Groq } from 'groq-sdk';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
        console.log("Access token likely expired, attempting refresh.");
        if (!refreshToken) {
          throw new Error("Authentication expired. No refresh token available.");
        }
        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;
        await User.updateOne({ spotifyId: user.spotifyId }, { $set: { accessToken } });
        return await fetcher(accessToken);
      }
    };

    const [userProfile, topArtists, topTracks, savedTracks, playlists] = await Promise.all([
      fetchWithRefresh(token => getUserProfile(token)),
      fetchWithRefresh(token => getTopItems(token, 'artists')),
      fetchWithRefresh(token => getTopItems(token, 'tracks')),
      fetchWithRefresh(token => getAllSavedTracks(token)),
      fetchWithRefresh(token => getUserPlaylists(token, user.spotifyId)),
    ]);

    const compiledData = {
      userProfile: {
        displayName: userProfile.display_name,
        email: userProfile.email,
        country: userProfile.country,
      },
      topArtists: topArtists.items.map((artist: any) => ({
        name: artist.name,
        genres: artist.genres,
      })),
      topTracks: topTracks.items.map((track: any) => ({
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name),
        album: track.album.name,
      })),
      savedTracks: savedTracks.map((item: any) => ({
        name: item.track.name,
        artists: item.track.artists.map((artist: any) => artist.name),
        album: item.track.album.name,
      })),
      playlists: playlists.map((playlist: any) => ({
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.tracks.total,
      })),
    };

    const llmResponse = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content: 'You are a music analysis expert. Analyze the user\'s Spotify data and provide insights into their music taste.',
            },
            {
                role: 'user',
                content: `Analyze this user's Spotify data and provide insights on their music tastes, favorite genres, and potential recommendations.\n\n${JSON.stringify(compiledData, null, 2)}`,
            },
        ],
        model: 'gemma2-9b-it',
    });

    return NextResponse.json({
        analysis: llmResponse.choices[0].message.content,
        rawData: compiledData,
    });

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
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status });
  }
}