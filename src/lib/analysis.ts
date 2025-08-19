import { getAudioFeatures, getArtists } from './spotify';
import User from '@/models/user.model';

interface Track {
  added_at: string;
  track: {
    id: string;
    artists: { id: string; name: string }[];
  };
}

export interface Era {
  timeframe: string;
  eraName: string;
  topArtists: string[];
  topGenres: string[];
  avgFeatures: {
    energy: number;
    valence: number;
    danceability: number;
  };
  trackIds: string[];
}

// This function now expects a function that can make authorized requests,
// rather than handling the token refresh itself.
export async function analyzeMusicalEras(
  savedTracks: Track[],
  fetcher: <T>(apiCall: (token: string) => Promise<T>) => Promise<T>
): Promise<Era[]> {
  // 1. Sort tracks chronologically
  const sortedTracks = savedTracks
    .filter(item => item && item.track && item.track.id)
    .sort((a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime());

  if (sortedTracks.length < 20) {
    return []; // Not enough data to analyze
  }

  const erasData: Era[] = [];
  const tracksPerEra = Math.max(20, Math.ceil(sortedTracks.length / 5)); // Create up to 5 eras

  // Pre-fetch all audio features at once for efficiency
  const allTrackIds = sortedTracks.map(item => item.track.id);
  const audioFeaturesList = await fetcher(token => getAudioFeatures(token, allTrackIds));
  const audioFeaturesMap = new Map(audioFeaturesList.filter(f => f).map(f => [f.id, f]));

  for (let i = 0; i < sortedTracks.length; i += tracksPerEra) {
    const eraTracks = sortedTracks.slice(i, i + tracksPerEra);
    if (eraTracks.length < 10) continue; // Skip small trailing eras

    const trackIds = eraTracks.map(item => item.track.id);

    // 2. Thematic Analysis: Top Artists and Genres
    const artistCounts: Record<string, number> = {};
    const artistIdMap: Record<string, string> = {};
    eraTracks.forEach(item => {
      item.track.artists.forEach(artist => {
        artistCounts[artist.name] = (artistCounts[artist.name] || 0) + 1;
        artistIdMap[artist.name] = artist.id;
      });
    });

    const topArtistsNames = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    const topArtistIds = topArtistsNames.map(name => artistIdMap[name]).filter(id => id);
    const artistsDetails = topArtistIds.length > 0
      ? await fetcher(token => getArtists(token, topArtistIds))
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

    // 3. Feature Analysis: Average Audio Features
    const features = trackIds.map(id => audioFeaturesMap.get(id)).filter((f): f is any => !!f);
    
    const safeAvg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((acc, val) => acc + val, 0) / arr.length);

    const avgFeatures = {
      energy: safeAvg(features.map(f => f.energy)),
      valence: safeAvg(features.map(f => f.valence)),
      danceability: safeAvg(features.map(f => f.danceability)),
    };

    // 4. Structure Era Data
    const firstTrackDate = new Date(eraTracks[0].added_at);
    const lastTrackDate = new Date(eraTracks[eraTracks.length - 1].added_at);
    const timeframe = firstTrackDate.getFullYear() === lastTrackDate.getFullYear()
      ? `${firstTrackDate.getFullYear()}`
      : `${firstTrackDate.getFullYear()} - ${lastTrackDate.getFullYear()}`;

    const eraName = `The ${topGenres[0] ? topGenres[0].split(' ').map(w => w[0].toUpperCase() + w.substring(1)).join(' ') : 'Eclectic'} Era`;

    erasData.push({
      timeframe,
      eraName,
      topArtists: topArtistsNames,
      topGenres,
      avgFeatures,
      trackIds,
    });
  }

  return erasData;
}