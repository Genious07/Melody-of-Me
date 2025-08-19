"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { Mail, Users, Globe } from 'lucide-react';

interface SpotifyUser {
  display_name: string;
  email: string;
  country: string;
  followers: {
    total: number;
  };
  product: string;
}

function ProfileItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-medium">{value || 'N/A'}</p>
      </div>
    </div>
  )
}

export default function UserProfile() {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/user');
        if (!res.ok) {
          throw new Error('Failed to fetch user data');
        }
        const data = await res.json();
        setUser(data);
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load your profile. Please try logging out and back in.",
        });
        // Redirect to logout to clear corrupted session
        setTimeout(() => {
          window.location.href = '/api/logout';
        }, 3000);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64 mt-2" />
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg"/>
                <div>
                    <Skeleton className="h-4 w-20"/>
                    <Skeleton className="h-6 w-24 mt-1"/>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg"/>
                <div>
                    <Skeleton className="h-4 w-20"/>
                    <Skeleton className="h-6 w-24 mt-1"/>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg"/>
                <div>
                    <Skeleton className="h-4 w-20"/>
                    <Skeleton className="h-6 w-24 mt-1"/>
                </div>
            </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Your Profile</CardTitle>
            {user.product && <Badge variant="secondary" className="capitalize">{user.product}</Badge>}
        </div>
        <CardDescription>This is your information according to Spotify.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <ProfileItem icon={<Mail size={20}/>} label="Email" value={user.email} />
        <ProfileItem icon={<Globe size={20}/>} label="Country" value={user.country} />
        <ProfileItem icon={<Users size={20}/>} label="Followers" value={user.followers?.total} />
      </CardContent>
    </Card>
  );
}
