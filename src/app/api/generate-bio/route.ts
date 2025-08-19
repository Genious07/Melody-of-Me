import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateBio, BioInputSchema } from '@/ai/flows/generate-bio-flow';
import Biography from '@/models/biography.model';
import clientPromise from '@/lib/mongodb';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;

    if (!accessToken) {
        return new NextResponse('User not authenticated', { status: 401 });
    }

    const body = await request.json();
    const parseResult = BioInputSchema.safeParse({ eras: body.eras });

    if (!parseResult.success) {
        return new NextResponse(JSON.stringify(parseResult.error.format()), { status: 400 });
    }

    const eras = parseResult.data.eras;

    // Fetch user ID for linking the biography
    // A more robust app might get this from a session or a DB lookup
    // For now, we'll fetch it again.
    let userId: string;
    try {
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/user`, {
            headers: request.headers,
        });
        if (!userRes.ok) throw new Error("Could not fetch user to save biography");
        const userData = await userRes.json();
        userId = userData.id;
    } catch(e) {
        console.error(e);
        return new NextResponse('Could not verify user to save biography', { status: 500 });
    }
    

    try {
        const fullBiography = await generateBio({ eras });
        const shareId = randomUUID();

        await clientPromise; // Ensure DB connection
        
        const newBio = new Biography({
            userId: userId,
            shareId: shareId,
            content: fullBiography,
            eras: eras,
        });

        await newBio.save();

        return NextResponse.json({
            biography: newBio.content,
            shareId: newBio.shareId,
        });

    } catch (error) {
        console.error('Error generating biography:', error);
        return new NextResponse('Failed to generate biography.', { status: 500 });
    }
}
