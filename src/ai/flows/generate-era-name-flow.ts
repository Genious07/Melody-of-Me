'use server';
/**
 * @fileOverview A flow to generate a descriptive name for a musical era.
 *
 * - generateEraName - A function that creates a name for a musical era based on its characteristics.
 * - EraInput - The input type for the generateEraName function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';

const EraInputSchema = z.object({
  topArtists: z.array(z.string()).describe('The top artists in this era.'),
  topGenres: z.array(z.string()).describe('The top genres in this era.'),
  avgFeatures: z.object({
    energy: z.number().describe('The average energy of the music (0.0 to 1.0). High energy is fast and loud.'),
    valence: z.number().describe('The average valence (positiveness) of the music (0.0 to 1.0). High valence is happy, low is sad.'),
    danceability: z.number().describe('The average danceability of the music (0.0 to 1.0).'),
  }).describe('The average audio features of the music in this era.'),
});
export type EraInput = z.infer<typeof EraInputSchema>;

export async function generateEraName(input: EraInput): Promise<string> {
    const { text } = await generateEraNamePrompt(input);
    // Return the text, removing quotes if they exist.
    return text.replace(/"/g, '');
}

const generateEraNamePrompt = ai.definePrompt({
  name: 'generateEraNamePrompt',
  input: { schema: EraInputSchema },
  prompt: `You are a creative music journalist. Your task is to coin a catchy, evocative, and descriptive name for a person's musical era based on the data provided. The name should be 2-5 words long.

Here are the characteristics of the era:
- Top Genres: {{topGenres}}
- Top Artists: {{topArtists}}
- Average Energy: {{avgFeatures.energy}} (a measure of intensity and activity)
- Average Valence: {{avgFeatures.valence}} (a measure of musical positiveness)
- Average Danceability: {{avgFeatures.danceability}}

Based on this data, generate a single, creative name for this musical era. For example: "Melancholic Indie Winter", "Upbeat Summer Pop", "Experimental Electronic Nights", or "Soulful Acoustic Mornings".

Era Name:`,
});
