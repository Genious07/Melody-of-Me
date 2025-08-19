import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllSavedTracks, getAudioFeatures, getArtists, refreshAccessToken } from '@/lib/spotify';
import { kmeans } from 'ml-kmeans';

// Helper function to handle token refresh
async function fetchWithRefresh(refreshToken: string, fetcher: (token: string) => Promise<any>) {
    try {
        const newTokens = await refreshAccessToken(refreshToken);
        const cookieStore = cookies();
        cookieStore.set('spotify_access_token', newTokens.access_token, {
            httpOnly: true,
            path: '/',
            maxAge: newTokens.expires_in,
        });

        if (newTokens.refresh_token) {
            cookieStore.set('spotify_refresh_token', newTokens.refresh_token, {
                httpOnly: true,
                path: '/',
                maxAge: 60 * 60 * 24 * 30, // 30 days
            });
        }
        return await fetcher(newTokens.access_token);
    } catch (e) {
        console.error("Token refresh failed", e);
        throw new Error("Authentication expired. Please log in again.");
    }
}

async function analyzeUserMusic(accessToken: string, refreshToken: string) {
    let savedTracks;
    try {
        savedTracks = await getAllSavedTracks(accessToken);
    } catch (e) {
        console.log("Access token likely expired, attempting refresh for saved tracks.");
        savedTracks = await fetchWithRefresh(refreshToken, (token) => getAllSavedTracks(token));
    }

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
        
        let audioFeatures;
        try {
            audioFeatures = await getAudioFeatures(accessToken, trackIds);
        } catch (e) {
            console.log("Access token likely expired, attempting refresh for audio features.");
            audioFeatures = await fetchWithRefresh(refreshToken, (token) => getAudioFeatures(token, trackIds));
        }
        
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
            
            let artistsData;
             try {
                artistsData = await getArtists(accessToken, clusterArtistIds);
            } catch (e) {
                console.log("Access token likely expired, attempting refresh for artists.");
                artistsData = await fetchWithRefresh(refreshToken, (token) => getArtists(token, clusterArtistIds));
            }

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
    const accessToken = cookieStore.get('spotify_access_token')?.value;
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

    if (!accessToken || !refreshToken) {
        return new NextResponse('User not authenticated', { status: 401 });
    }

    try {
        const analysisResult = await analyzeUserMusic(accessToken, refreshToken);
        return NextResponse.json(analysisResult);
    } catch (error: any) {
        console.error('Analysis failed:', error);
         if (error.message.includes("Authentication expired")) {
            const response = new NextResponse(error.message, { status: 401 });
             response.cookies.delete('spotify_access_token');
             response.cookies.delete('spotify_refresh_token');
            return response;
        }
        return new NextResponse('Failed to analyze music data.', { status: 500 });
    }
}
