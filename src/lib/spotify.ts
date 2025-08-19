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


export const getAudioFeatures = async (token: string, trackIds: string[]): Promise<any[]> => {
    if (!Array.isArray(trackIds) || trackIds.length === 0) return [];

    const CHUNK_SIZE = 100;
    const allFeatures: any[] = [];

    for (let i = 0; i < trackIds.length; i += CHUNK_SIZE) {
        const chunk = trackIds.slice(i, i + CHUNK_SIZE);
        const ids = chunk.join(',');
        const url = `https://api.spotify.com/v1/audio-features?ids=${ids}`;

        let attempt = 0;
        const maxAttempts = 5;
        while (attempt < maxAttempts) {
            try {
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || '1';
                    const waitMs = parseInt(retryAfter, 10) * 1000;
                    console.warn(`Rate limited. Retrying after ${waitMs}ms...`);
                    await new Promise(res => setTimeout(res, waitMs));
                    attempt++;
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`Failed to fetch audio features with status: ${response.status}`);
                }

                const data = await response.json();
                const features = data.audio_features || [];
                allFeatures.push(...features.filter((f: any) => f)); // Filter out nulls
                break; // Success, exit retry loop

            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error);
                attempt++;
                if (attempt >= maxAttempts) {
                    throw new Error(`Failed to fetch audio features after ${maxAttempts} attempts.`);
                }
                // Exponential backoff for other errors
                await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    return allFeatures;
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