import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SpotifyIcon from './icons/spotify-icon';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-0 bg-card shadow-2xl shadow-primary/10 sm:border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">
            Melody of Me
          </CardTitle>
          <CardDescription className="pt-2 text-base">
            Discover the music that defines you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 pt-0">
          <p className="mb-6 text-center text-muted-foreground">
            Connect your Spotify account to unlock your personal music insights.
          </p>
          <Button asChild size="lg" className="w-full max-w-xs font-bold">
            <Link href="/api/login">
              <SpotifyIcon className="mr-2 h-5 w-5" />
              Login with Spotify
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
