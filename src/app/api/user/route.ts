import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserProfile, refreshAccessToken } from '@/lib/spotify';
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

    try {
        // Try fetching profile with current access token
        const userProfile = await getUserProfile(user.accessToken);
        return NextResponse.json(userProfile);
    } catch (error) {
        console.log("Access token likely expired, attempting refresh...");

        if (!user.refreshToken) {
            const response = new NextResponse('Session expired, please log in again.', { status: 401 });
            response.cookies.delete('session_token');
            return response;
        }

        try {
            const newTokens = await refreshAccessToken(user.refreshToken);
            
            // Update the user's access token in the database
            await User.updateOne(
                { spotifyId: user.spotifyId },
                { $set: { accessToken: newTokens.access_token } }
            );

            // Retry fetching the profile with the new token
            const userProfile = await getUserProfile(newTokens.access_token);
            return NextResponse.json(userProfile);

        } catch (refreshError) {
            console.error("Failed to refresh token:", refreshError);
            const response = new NextResponse('Authentication expired. Please log in again.', { status: 401 });
            response.cookies.delete('session_token');
            // Also clear the invalid refresh token from the DB
            await User.updateOne({ spotifyId: user.spotifyId }, { $unset: { refreshToken: "" } });
            return response;
        }
    }
}
