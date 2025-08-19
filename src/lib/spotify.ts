const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
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
        // If token is expired, this will fail. The caller should handle this.
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

export const getAudioFeatures = async (token: string, trackIds: string[]): Promise<any[]> => {
    let features: any[] = [];
    // Batch trackIds into chunks of 100
    for (let i = 0; i < trackIds.length; i += 100) {
        const batch = trackIds.slice(i, i + 100);
        const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${batch.join(',')}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch audio features');
        }

        const data = await response.json();
        features = features.concat(data.audio_features);
    }
    return features;
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
