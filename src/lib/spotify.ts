// src/lib/spotify.ts

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export const getAccessToken = async (code: string, redirect_uri: string): Promise<TokenResponse> => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to fetch access token');
  }

  return response.json();
};

export const refreshAccessToken = async (refresh_token: string): Promise<TokenResponse> => {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to refresh access token');
    }

    return response.json();
  };

export const getUserProfile = async (access_token: string) => {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user profile');
    }

    return response.json();
}

export const getAllSavedTracks = async (token: string): Promise<any[]> => {
    let tracks: any[] = [];
    let nextUrl: string | null = 'https://api.spotify.com/v1/me/tracks?limit=50';

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch saved tracks');
        }

        const data = await response.json();
        tracks = tracks.concat(data.items);
        nextUrl = data.next;
    }

    return tracks;
};

export const getTopItems = async (token: string, type: 'artists' | 'tracks', time_range: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit: number = 50) => {
    const response = await fetch(`https://api.spotify.com/v1/me/top/${type}?time_range=${time_range}&limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch top ${type}`);
    }
    return response.json();
};

export const getTrack = async (token: string, id: string, market?: string) => {
    const url = new URL(`https://api.spotify.com/v1/tracks/${id}`);
    if (market) {
        url.searchParams.append('market', market);
    }
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch track');
    }
    return response.json();
};

export const getUserPlaylists = async (token: string, userId: string) => {
    let playlists: any[] = [];
    let nextUrl: string | null = `https://api.spotify.com/v1/users/${userId}/playlists?limit=50`;

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            const error = await response.json();
            console.error('Failed to fetch user playlists:', error);
            throw new Error('Failed to fetch user playlists');
        }
        const data = await response.json();
        playlists = playlists.concat(data.items);
        nextUrl = data.next;
    }
    return playlists;
};


export const getTracksDetails = async (token: string, trackIds: string[]): Promise<any[]> => {
    if (!Array.isArray(trackIds) || trackIds.length === 0) return [];

    const CHUNK_SIZE = 50; // Max 50 for /v1/tracks
    const allTracks: any[] = [];

    for (let i = 0; i < trackIds.length; i += CHUNK_SIZE) {
        const chunk = trackIds.slice(i, i + CHUNK_SIZE);
        const ids = chunk.join(',');
        const url = `https://api.spotify.com/v1/tracks?ids=${ids}`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error(`Spotify API Error for tracks: ${errorDetails}`);
            throw new Error(`Failed to fetch track details with status: ${response.status}.`);
        }

        const data = await response.json();
        allTracks.push(...(data.tracks || []));
    }
    return allTracks;
};


export const getArtists = async (token: string, artistIds: string[]): Promise<any[]> => {
    let artists: any[] = [];
     for (let i = 0; i < artistIds.length; i += 50) {
        const batch = artistIds.slice(i, i + 50);
        const response = await fetch(`https://api.spotify.com/v1/artists?ids=${batch.join(',')}`, {
          headers: {
              Authorization: `Bearer ${token}`,
          },
      });
        if (!response.ok) {
            throw new Error('Failed to fetch artists');
        }
         const data = await response.json();
        artists = artists.concat(data.artists);
    }
    return artists;
}