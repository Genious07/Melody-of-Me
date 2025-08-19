import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserProfile, refreshAccessToken } from '@/lib/spotify';
import clientPromise from '@/lib/mongodb';

async function fetchWithRefresh(accessToken: string, refreshToken: string) {
    try {
        return await getUserProfile(accessToken);
    } catch (error) {
        console.log("Access token expired, refreshing...");
        const newTokens = await refreshAccessToken(refreshToken);
        
        const cookieStore = cookies();
        cookieStore.set('spotify_access_token', newTokens.access_token, {
            httpOnly: true,
            path: '/',
            maxAge: newTokens.expires_in,
        });

        // The new response might not include a new refresh token, so we only update if it exists.
        if (newTokens.refresh_token) {
            cookieStore.set('spotify_refresh_token', newTokens.refresh_token, {
                httpOnly: true,
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
            });
        }
        
        return await getUserProfile(newTokens.access_token);
    }
}


export async function GET(request: NextRequest) {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

    if (!accessToken || !refreshToken) {
        return new NextResponse('User not authenticated', { status: 401 });
    }

    try {
        const userProfile = await fetchWithRefresh(accessToken, refreshToken);
        
        // Store user data in MongoDB
        const client = await clientPromise;
        const db = client.db("melodyofme");
        await db.collection("users").updateOne(
            { id: userProfile.id },
            { $set: userProfile, $currentDate: { lastLogin: true } },
            { upsert: true }
        );

        return NextResponse.json(userProfile);
    } catch (error: any) {
        console.error("Failed to get user profile:", error);
        // If refresh also fails, then we need to re-authenticate
        if (error.message.includes('refresh')) {
             const response = new NextResponse('Authentication expired. Please log in again.', { status: 401 });
             response.cookies.delete('spotify_access_token');
             response.cookies.delete('spotify_refresh_token');
             return response;
        }
        return new NextResponse('Failed to fetch user data from Spotify.', { status: 500 });
    }
}
