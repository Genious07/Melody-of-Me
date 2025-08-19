'use server';
/**
 * @fileOverview A flow to generate a musical biography from a user's listening eras.
 * 
 * - generateBio - A function that creates a narrative biography.
 * - BioInput - The input type for the generateBio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';

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

export const BioInputSchema = z.object({
  eras: z.array(EraSchema),
});
export type BioInput = z.infer<typeof BioInputSchema>;


const biographyPrompt = ai.definePrompt({
    name: 'generateBioPrompt',
    input: { schema: EraSchema },
    prompt: `You are a witty, insightful music journalist crafting a chapter of a person's musical biography.
Your tone is personal, creative, and evocative.
Write one rich paragraph (around 80-100 words) for the musical era named "{{eraName}}".
Focus on the feeling and narrative of this phase, using the data below as inspiration, but don't just list the data.

Details of the Era:
- Name: "{{eraName}}"
- Timeframe: {{timeframe}}
- Key Artists: {{topArtists}}
- Dominant Genres: {{topGenres}}
- Vibe: Energy level is {{avgFeatures.energy}} (0-1 scale), and happiness/positivity is {{avgFeatures.valence}} (0-1 scale).
`,
});


export async function generateBio(input: BioInput): Promise<string> {
    const narrativePromises = input.eras.map(era => {
        return biographyPrompt(era);
    });

    const completions = await Promise.all(narrativePromises);
    
    const narrativeParts = completions.map(
        completion => completion.text.trim()
    );

    return narrativeParts.join('\n\n');
}
