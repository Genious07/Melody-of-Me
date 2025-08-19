import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Biography from '@/models/biography.model';
import clientPromise from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { Groq } from 'groq-sdk';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import User from '@/models/user.model';


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';


const EraSchema = z.object({
  timeframe: z.string(),
  eraName: z.string(),
  topArtists: z.array(z.string()),
  topGenres: z.array(z.string()),
  avgFeatures: z.object({
    energy: z.number(),
    valence: z.number(),
    danceability: z.number(),
  }),
  trackIds: z.array(z.string()),
});

const BioInputSchema = z.object({
  eras: z.array(EraSchema),
});


// Helper function to generate a prompt for a single era
const createPromptForEra = (era: z.infer<typeof EraSchema>): string => {
    const topArtists = era.topArtists.slice(0, 3).join(', ');
    const genres = era.topGenres.slice(0, 3).join(', ');
    const energy = Math.round(era.avgFeatures.energy * 100);
    const valence = Math.round(era.avgFeatures.valence * 100);

    return `You are a witty, insightful music journalist crafting a chapter of a person's musical biography.
    Write one evocative paragraph (around 80-100 words) describing this musical phase named "${era.eraName}".
    Focus on the feeling and narrative, not just listing data. Be personal and creative.

    Details of the Era:
    - Timeframe: ${era.timeframe}
    - Key Artists: ${topArtists}
    - Dominant Genres: ${genres}
    - Vibe: Energy level at ${energy}% and Happiness/Positivity at ${valence}%.`;
};

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parseResult = BioInputSchema.safeParse({ eras: body.eras });

    if (!parseResult.success) {
        return new NextResponse(JSON.stringify(parseResult.error.format()), { status: 400 });
    }

    const { eras } = parseResult.data;
    
    try {
        await clientPromise;
        const user = await User.findOne({ spotifyId: decoded.spotifyId });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }
        
        const userId = user._id;

        const narrativePromises = eras.map(era => {
            const prompt = createPromptForEra(era);
            return groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'mixtral-8x7b-32768',
                temperature: 0.7,
                max_tokens: 256,
            });
        });

        const completions = await Promise.all(narrativePromises);
        
        const narrativeParts = completions.map(
            completion => completion.choices[0]?.message?.content?.trim() || ''
        );
        const fullBiography = narrativeParts.join('\n\n');

        const shareId = uuidv4();
        
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
