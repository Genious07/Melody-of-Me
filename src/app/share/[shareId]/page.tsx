"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Music4 } from 'lucide-react';

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
  content: string;
  eras: Era[];
}

export default function SharePage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [biography, setBiography] = useState<Biography | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mainRef = useRef(null);

  useEffect(() => {
    if (shareId) {
      const fetchBiography = async () => {
        try {
          const res = await fetch(`/api/share/${shareId}`);
          if (!res.ok) {
            if (res.status === 404) {
              throw new Error('This musical journey could not be found. It may have expired or the link is incorrect.');
            }
            throw new Error('Failed to load the sonic biography.');
          }
          const data = await res.json();
          setBiography(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchBiography();
    }
  }, [shareId]);

  useEffect(() => {
    if (biography && mainRef.current) {
      const initAnimations = async () => {
        try {
            const { Controller, Scene } = await import('scrollmagic');
            await import('scrollmagic-plugin-gsap');
            const { gsap } = await import('gsap');

            const controller = new Controller();

            const bioParagraphs = (mainRef.current as HTMLElement).querySelectorAll('.bio-paragraph');
            
            gsap.fromTo(bioParagraphs, 
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 1, stagger: 0.3, ease: 'power3.out' }
            );

            biography.eras.forEach((era, index) => {
                const triggerEl = document.querySelector(`#era-section-${index}`);
                const titleEl = document.querySelector(`#era-title-${index}`);
                if (!triggerEl || !titleEl) return;

                new Scene({
                    triggerElement: triggerEl,
                    triggerHook: 'onLeave',
                    duration: (triggerEl as HTMLElement).offsetHeight - (titleEl as HTMLElement).offsetHeight,
                    offset: -titleEl.getBoundingClientRect().height, 
                })
                .setPin(`#era-title-${index}`, { pushFollowers: true })
                .addTo(controller);

                new Scene({
                  triggerElement: triggerEl,
                  triggerHook: 0.8,
                  reverse: false
                })
                .on('enter', () => {
                  gsap.fromTo(triggerEl.querySelectorAll('.era-badge'), 
                    { opacity: 0, scale: 0.8 },
                    { opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.7)'}
                  )
                })
                .addTo(controller);
            });
        } catch (e) {
            console.error("Failed to load animation libraries", e);
        }
      };

      // Ensure fonts are loaded before calculating element heights
      document.fonts.ready.then(initAnimations);
    }
  }, [biography]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Tuning up the session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle className="text-destructive">An Error Occurred</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{error}</p>
            </CardContent>
          </Card>
      </div>
    )
  }

  return (
    <>
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-center border-b bg-background/80 px-4 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Music4/>
            Melody of Me
        </h1>
    </header>
    <main ref={mainRef} className="p-4 md:p-8 max-w-4xl mx-auto text-foreground">
      
      {biography && (
        <>
            <div className="text-center my-12">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">A Sonic Biography</h1>
                <p className="text-lg text-muted-foreground">
                    A story written in sound, based on a unique listening history.
                </p>
            </div>
            
            <div className="my-8 prose prose-invert max-w-none prose-p:text-lg prose-p:leading-relaxed text-foreground/90 space-y-6">
                {biography.content.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="bio-paragraph">{paragraph}</p>
                ))}
            </div>

            <div className="mt-24 space-y-16">
            {biography.eras.map((era, index) => (
                <section key={index} id={`era-section-${index}`} className="min-h-[50vh]">
                    <div id={`era-title-${index}`} className="py-4 bg-background">
                        <h2 className="text-3xl font-bold tracking-tighter">{era.eraName}</h2>
                        <p className="text-muted-foreground">{era.timeframe}</p>
                    </div>
                    <div className="pt-8 pl-4 border-l-2 border-primary/20 ml-2">
                        <div className="mb-8">
                            <h4 className="font-semibold mb-3 text-primary">Top Genres</h4>
                            <div className="flex flex-wrap gap-2">
                                {era.topGenres.map(g => <Badge key={g} variant="secondary" className="era-badge text-base py-1 px-3">{g}</Badge>)}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-primary">Top Artists</h4>
                            <div className="flex flex-wrap gap-2">
                                {era.topArtists.map(a => <Badge key={a} variant="outline" className="era-badge text-base py-1 px-3">{a}</Badge>)}
                            </div>
                        </div>
                    </div>
                </section>
            ))}
            </div>
        </>
      )}
    </main>
    </>
  );
}
