// src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getAllSavedTracks,
  refreshAccessToken,
  getAudioFeatures,
  getArtists,
} from '@/lib/spotify';
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

    // 1. Fetch all saved tracks, filter out any null tracks, and sort them chronologically
    const savedTracks = (await fetchWithRefresh(token => getAllSavedTracks(token)))
      .filter(item => item && item.track && item.track.id)
      .sort((a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime());

    // If user has too few tracks, return empty to prevent errors
    if (savedTracks.length < 20) {
        return NextResponse.json([]);
    }

    // 2. Fetch Audio Features for all tracks
    const allTrackIds = savedTracks.map(item => item.track.id);
    const audioFeaturesList = await fetchWithRefresh(token => getAudioFeatures(token, allTrackIds));
    const audioFeaturesMap = new Map(audioFeaturesList.filter(f => f).map(f => [f.id, f]));
    
    // 3. Define Eras by dividing the tracks into chunks
    const erasData = [];
    const tracksPerEra = Math.max(20, Math.ceil(savedTracks.length / 5)); // Create up to 5 eras, with at least 20 tracks each
    
    for (let i = 0; i < savedTracks.length; i += tracksPerEra) {
        const eraTracks = savedTracks.slice(i, i + tracksPerEra);
        if (eraTracks.length < 10) continue; // Skip tiny trailing eras

        const trackIds = eraTracks.map(item => item.track.id);
        
        // 4. Calculate average audio features for the era
        const features = trackIds.map(id => audioFeaturesMap.get(id)).filter((f): f is any => !!f);
        
        if (features.length === 0) {
          console.warn(`No audio features found for era starting ${eraTracks[0]?.added_at}. Skipping era.`);
          continue;
        }

        const safeAvg = (arr: number[]) => {
            if (arr.length === 0) return 0;
            return arr.reduce((acc, val) => acc + val, 0) / arr.length;
        };

        const avgFeatures = {
            energy: safeAvg(features.map(f => f.energy)),
            valence: safeAvg(features.map(f => f.valence)),
            danceability: safeAvg(features.map(f => f.danceability)),
        };

        // 5. Determine top artists and genres for the era
        const artistCounts: Record<string, number> = {};
        const artistIdMap: Record<string, string> = {};
        eraTracks.forEach(item => {
            item.track.artists.forEach((artist: any) => {
                artistCounts[artist.name] = (artistCounts[artist.name] || 0) + 1;
                artistIdMap[artist.name] = artist.id;
            });
        });

        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0]);

        const topArtistIds = topArtists.map(name => artistIdMap[name]).filter(id => id);
        const artistsDetails = topArtistIds.length > 0
            ? await fetchWithRefresh(token => getArtists(token, topArtistIds))
            : [];
        
        const genreCounts: Record<string, number> = {};
        artistsDetails.forEach(artist => {
            (artist.genres || []).forEach((genre: string) => {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            });
        });

        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0]);

        // 6. Define timeframe and name for the era
        const firstTrackDate = new Date(eraTracks[0].added_at);
        const lastTrackDate = new Date(eraTracks[eraTracks.length - 1].added_at);
        const timeframe = firstTrackDate.getFullYear() === lastTrackDate.getFullYear()
            ? `${firstTrackDate.getFullYear()}`
            : `${firstTrackDate.getFullYear()} - ${lastTrackDate.getFullYear()}`;
        
        const eraName = `The ${topGenres[0] ? topGenres[0].split(' ').map(w => w[0].toUpperCase() + w.substring(1)).join(' ') : 'Eclectic'} Era`;

        erasData.push({
            timeframe,
            eraName,
            topArtists,
            topGenres,
            avgFeatures,
            trackIds,
        });
    }
    
    return NextResponse.json(erasData);

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
