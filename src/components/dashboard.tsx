"use client"
import { useState, useEffect, useRef } from 'react';
import Header from "./header";
import UserProfile from "./user-profile";
import { Button } from './ui/button';
import { Loader2, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { BarChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, XAxis, YAxis } from "recharts"
import { useToast } from '@/hooks/use-toast';

interface Era {
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

interface Biography {
    biography: string;
    shareId: string;
}

const chartConfig = {
  energy: {
    label: "Energy",
    color: "hsl(var(--chart-1))",
  },
  valence: {
    label: "Valence",
    color: "hsl(var(--chart-2))",
  },
  danceability: {
    label: "Danceability",
    color: "hsl(var(--chart-3))",
  },
} satisfies Record<string, any>

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<Era[] | null>(null);
  const [biography, setBiography] = useState<Biography | null>(null);
  const { toast } = useToast();

  const eraCardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const bioRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // This effect runs only on the client, after the component has mounted.
    // It's safe to use window and browser-specific libraries here.
    const initAnimations = async () => {
        // Dynamically import libraries to ensure they only run on the client
        const ScrollReveal = (await import('scrollreveal')).default;
        const gsap = (await import('gsap')).default;
        const anime = (await import('animejs')).default;

        if (analysisData && eraCardsRef.current.length > 0) {
            ScrollReveal().reveal('.scroll-reveal', {
                delay: 200,
                distance: '50px',
                origin: 'bottom',
                easing: 'ease-in-out',
                reset: false,
                viewFactor: 0.2,
            });
            gsap.fromTo(eraCardsRef.current,
                { y: 50, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out' }
            );
        }

        if (biography && bioRef.current) {
          anime({
            targets: bioRef.current.querySelectorAll('p'),
            translateY: [20, 0],
            opacity: [0, 1],
            delay: anime.stagger(100, { start: 200 }),
            easing: 'easeOutExpo',
          });
        }
    };
    
    // We only want to run animations if there's something to animate.
    if (analysisData || biography) {
        initAnimations();
    }
  }, [analysisData, biography]);


  const handleGenerateClick = async () => {
    setIsLoading(true);
    setAnalysisData(null);
    setBiography(null);

    try {
      // 1. Analyze music
      const analyzeRes = await fetch('/api/analyze');
      if (analyzeRes.status === 401) {
        window.location.href = '/api/logout';
        return;
      }
      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json();
        throw new Error(errorData.message || 'Analysis failed');
      }
      const eras: Era[] = await analyzeRes.json();
      

      if (eras.length === 0) {
        toast({
            title: "Not enough music history",
            description: "We couldn't find enough saved tracks to create your biography. Try adding more songs to your Spotify library!",
            variant: "default",
        });
        setIsLoading(false);
        return;
      }
      setAnalysisData(eras);

      // 2. Generate biography
      const bioRes = await fetch('/api/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eras }),
      });
      if (bioRes.status === 401) {
          window.location.href = '/api/logout';
          return;
      }
      if (!bioRes.ok) {
        const errorData = await bioRes.json();
        throw new Error(errorData.message || 'Biography generation failed');
      }
      const bio: Biography = await bioRes.json();
      setBiography(bio);

    } catch (err: any) {
      console.error(err);
      toast({
        title: "An error occurred",
        description: err.message || "Failed to generate your sonic biography. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
        <div className="mx-auto grid w-full max-w-6xl gap-8">
            <UserProfile />

            <div className="space-y-8">
                {analysisData && biography && (
                    <Card className="scroll-reveal">
                        <CardHeader>
                            <CardTitle className="text-2xl">Your Sonic Biography</CardTitle>
                            <CardDescription>A story written from your music taste.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div ref={bioRef} className="prose prose-invert max-w-none text-foreground/90 space-y-4">
                            {biography.biography.split('\n\n').map((paragraph, i) => (
                                <p key={i} className="opacity-0">{paragraph}</p>
                            ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {analysisData && (
                    <div className="scroll-reveal">
                        <h2 className="text-2xl font-semibold mb-4">Your Eras</h2>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {analysisData.map((era, index) => (
                            <Card key={index} ref={el => eraCardsRef.current[index] = el} className="flex flex-col opacity-0 bg-card/50 hover:bg-card transition-colors duration-300">
                            <CardHeader>
                                <CardTitle>{era.eraName}</CardTitle>
                                <CardDescription>{era.timeframe}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow flex flex-col gap-4">
                                <div>
                                    <h4 className="font-semibold mb-2 text-sm">Top Genres</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {era.topGenres.map(g => <Badge key={g} variant="secondary">{g}</Badge>)}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2 text-sm">Top Artists</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {era.topArtists.map(a => <Badge key={a} variant="outline">{a}</Badge>)}
                                    </div>
                                </div>
                                <div className="mt-auto pt-4">
                                    <h4 className="font-semibold mb-2 text-sm">Vibe</h4>
                                    <ChartContainer config={chartConfig} className="h-40 w-full">
                                        <BarChart accessibilityLayer data={[era.avgFeatures]} layout="vertical" margin={{ left: 10, right: 10 }}>
                                            <YAxis dataKey="name" type="category" hide />
                                            <XAxis type="number" domain={[0, 1]} hide />
                                            <ChartTooltip
                                                cursor={false}
                                                content={<ChartTooltipContent hideLabel />}
                                            />
                                            <Bar dataKey="energy" name="Energy" fill="var(--color-energy)" radius={5} barSize={15} />
                                            <Bar dataKey="valence" name="Valence" fill="var(--color-valence)" radius={5} barSize={15} />
                                            <Bar dataKey="danceability" name="Danceability" fill="var(--color-danceability)" radius={5} barSize={15} />
                                        </BarChart>
                                    </ChartContainer>
                                </div>
                            </CardContent>
                            </Card>
                        ))}
                        </div>
                    </div>
                )}
                
                {!analysisData && !isLoading && (
                    <div className="text-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                        <h2 className="text-xl font-semibold mb-2">Discover Your Musical Story</h2>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">Uncover the eras that defined your taste. Let's analyze your Spotify library and write your sonic biography.</p>
                        <Button size="lg" onClick={handleGenerateClick} disabled={isLoading}>
                        {isLoading ? (
                            <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Analyzing...
                            </>
                        ) : (
                            <>
                            <Zap className="mr-2 h-5 w-5" />
                            Generate My Sonic Biography
                            </>
                        )}
                        </Button>
                    </div>
                )}

                {isLoading && (
                    <div className="text-center p-8 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg min-h-[300px]">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Crafting Your Story...</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">This can take a moment. We're listening to years of your music history!</p>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  )
}
