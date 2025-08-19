import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Biography from '@/models/biography.model';
import dbConnect from '@/lib/dbConnect';
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
  avgPopularity: z.number(),
  medianReleaseYear: z.number(),
  trackIds: z.array(z.string()),
});

const BioInputSchema = z.object({
  eras: z.array(EraSchema),
});


// Helper function to generate a prompt for a single era
const createPromptForEra = (era: z.infer<typeof EraSchema>): string => {
    const topArtists = era.topArtists.slice(0, 3).join(', ');
    const genres = era.topGenres.slice(0, 3).join(', ');
    const popularityDescription = era.avgPopularity > 70 ? 'chart-topping hits' : era.avgPopularity > 40 ? 'a mix of popular and indie tracks' : 'more obscure and underground music';


    return `You are the music person and serve the pupose as describe the users personality and music type and what artist they like and what this all says about them a chapter of a person's musical biography.
    Write one evocative paragraph (around 80-100 words) describing this musical phase named "${era.eraName}".
    Focus on the feeling and narrative, describing the user's personality traits inferred from their music choices (e.g., adventurous, introspective, energetic), the type of music they enjoy, the artists they like (${topArtists}), and what this all says about them as a person. Be personal, creative, and weave in deeper insights—use web search if needed for artist backgrounds, genre meanings, or cultural implications.

    Details of the Era:
    - Timeframe: ${era.timeframe}
    - Key Artists: ${topArtists}
    - Dominant Genres: ${genres}
    - Vibe: During this time, the user listened to ${popularityDescription}, with a focus on music from around the year ${era.medianReleaseYear}. Sound Friendly Informative and musicy`;
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
        await dbConnect();
        const user = await User.findOne({ spotifyId: decoded.spotifyId });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }
        
        const userId = user._id;

        // Function to handle streaming completion and collect full content
        const getCompletionContent = async (prompt: string): Promise<string> => {
            const stream = await groq.chat.completions.create({
                messages: [{ role: 'system', content: prompt }],
                model: 'openai/gpt-oss-120b',
                temperature: 1,
                max_completion_tokens: 8192,
                top_p: 1,
                stream: true,
                reasoning_effort: 'low',
                reasoning_format: "hidden",
                stop: null,
                tools: [
                    {
                        type: 'browser_search'
                    }
                ]
            });

            let fullContent = '';
            for await (const chunk of stream) {
                fullContent += chunk.choices[0]?.delta?.content || '';
            }
            return fullContent.trim();
        };

        const narrativePromises = eras.map(async (era) => {
            const prompt = createPromptForEra(era);
            return getCompletionContent(prompt);
        });

        const narrativeParts = await Promise.all(narrativePromises);
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