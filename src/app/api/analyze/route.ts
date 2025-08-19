import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllSavedTracks, getAudioFeatures, getArtists, refreshAccessToken } from '@/lib/spotify';
import kmeans from 'ml-kmeans';
import jwt from 'jsonwebtoken';
import User from '@/models/user.model';
import dbConnect from '@/lib/dbConnect';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Helper function to handle token refresh
async function fetchWithRefresh(userId: string, currentAccessToken: string, currentRefreshToken: string, fetcher: (token: string) => Promise<any>) {
    try {
        // First, try with the current access token
        return await fetcher(currentAccessToken);
    } catch (e) {
        console.log("Access token likely expired, attempting refresh.");
        
        // If it fails, refresh the token
        const newTokens = await refreshAccessToken(currentRefreshToken);
        
        // Update the database with the new access token
        await User.findByIdAndUpdate(userId, {
            accessToken: newTokens.access_token,
            // Also update the refresh token if a new one was provided
            ...(newTokens.refresh_token && { refreshToken: newTokens.refresh_token })
        });
        
        // Retry the original fetcher function with the new token
        return await fetcher(newTokens.access_token);
    }
}

async function analyzeUserMusic(userId: string, accessToken: string, refreshToken: string) {
    const savedTracks = await fetchWithRefresh(userId, accessToken, refreshToken, (token) => getAllSavedTracks(token));

    if (!savedTracks || savedTracks.length === 0) {
        return [];
    }

    // Group tracks by 3-month windows
    const windows: { [key: string]: any[] } = {};
    savedTracks.forEach(item => {
        if (!item || !item.added_at || !item.track) return;
        const addedDate = new Date(item.added_at);
        const year = addedDate.getFullYear();
        const quarter = Math.floor(addedDate.getMonth() / 3) + 1;
        const key = `${year}-Q${quarter}`;
        if (!windows[key]) {
            windows[key] = [];
        }
        windows[key].push(item.track);
    });

    const eras = [];
    for (const key in windows) {
        const tracksInWindow = windows[key];
        if (tracksInWindow.length < 10) continue;

        const trackIds = tracksInWindow.map(t => t.id).filter(id => id);
        
        const audioFeatures = await fetchWithRefresh(userId, accessToken, refreshToken, (token) => getAudioFeatures(token, trackIds));
        
        const featuresMap = audioFeatures.reduce((acc: any, f: any) => {
            if (f) acc[f.id] = f;
            return acc;
        }, {});

        const clusterData = tracksInWindow
            .map(t => featuresMap[t.id])
            .filter(f => f)
            .map(f => [f.energy, f.valence, f.danceability]);
        
        if (clusterData.length < 4) continue;
        
        const K = Math.min(4, clusterData.length);
        const result = kmeans(clusterData, K, {});

        for (let i = 0; i < K; i++) {
            const clusterIndices = result.clusters.reduce((acc: number[], c: number, j: number) => {
                if (c === i) acc.push(j);
                return acc;
            }, []);

            if (clusterIndices.length < 5) continue;

            const clusterTracks = clusterIndices.map(index => tracksInWindow.find(t => featuresMap[t.id] && clusterData[index][0] === featuresMap[t.id].energy && clusterData[index][1] === featuresMap[t.id].valence));
            const validClusterTracks = clusterTracks.filter(t => t);

            if (validClusterTracks.length === 0) continue;
            
            const clusterTrackIds = validClusterTracks.map(t => t.id);
            const clusterArtistIds = [...new Set(validClusterTracks.flatMap(t => t.artists.map((a: any) => a.id)))];
            
            const artistsData = await fetchWithRefresh(userId, accessToken, refreshToken, (token) => getArtists(token, clusterArtistIds));

            const topArtists = artistsData.slice(0, 3).map(a => a.name);
            const topGenres = [...new Set(artistsData.flatMap(a => a.genres))].slice(0, 3);
            
            const avgFeatures = {
                energy: result.centroids[i][0],
                valence: result.centroids[i][1],
                danceability: result.centroids[i][2],
            };
            
            const eraName = "Generated Era Name";

            const timeframe = key.replace('-Q1', ' (Jan-Mar)').replace('-Q2', ' (Apr-Jun)').replace('-Q3', ' (Jul-Sep)').replace('-Q4', ' (Oct-Dec)');

            eras.push({
                timeframe,
                eraName,
                topArtists,
                topGenres,
                avgFeatures,
                trackIds: clusterTrackIds,
            });
        }
    }

    return eras;
}

export async function GET(request: NextRequest) {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
        return new NextResponse('User not authenticated', { status: 401 });
    }

    let decoded;
    try {
        decoded = jwt.verify(sessionToken, JWT_SECRET) as { spotifyId: string };
    } catch (error) {
        return new NextResponse('Invalid session token', { status: 401 });
    }

    try {
        await dbConnect();
        const user = await User.findOne({ spotifyId: decoded.spotifyId });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }

        const analysisResult = await analyzeUserMusic(user._id, user.accessToken, user.refreshToken);
        return NextResponse.json(analysisResult);

    } catch (error: any) {
        console.error('Analysis failed:', error);
         if (error.message.includes("Authentication expired")) {
            const response = new NextResponse(error.message, { status: 401 });
             response.cookies.delete('session_token');
            return response;
        }
        return new NextResponse('Failed to analyze music data.', { status: 500 });
    }
}
