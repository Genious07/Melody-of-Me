"use client"
import { useEffect, useState } from 'react';
import Link from "next/link"
import { LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Skeleton } from './ui/skeleton';

interface SpotifyUser {
    display_name: string;
    images: { url: string }[];
}

export default function Header() {
    const [user, setUser] = useState<SpotifyUser | null>(null);

    useEffect(() => {
        // We fetch a smaller subset of user data for the header
        // to avoid re-fetching everything. /api/user is already called
        // on the dashboard, this could be optimized with a global state manager.
        fetch('/api/user')
            .then(res => res.json())
            .then(data => setUser(data))
            .catch(err => console.error("Failed to fetch user for header", err))
    }, [])

    return (
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 z-50">
            <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
            <Link
                href="#"
                className="flex items-center gap-2 text-lg font-semibold md:text-base text-primary"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span className="sr-only">Melody of Me</span>
            </Link>
            <Link
                href="#"
                className="text-foreground transition-colors hover:text-foreground"
            >
                Dashboard
            </Link>
            </nav>
            <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
                <div className="ml-auto flex-1 sm:flex-initial">
                    {/* Placeholder for potential search bar */}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="rounded-full">
                            {user ? (
                                <Avatar>
                                    <AvatarImage src={user.images?.[0]?.url} alt={user.display_name} />
                                    <AvatarFallback>
                                        {user.display_name?.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                               <Skeleton className="h-10 w-10 rounded-full" />
                            )}
                            <span className="sr-only">Toggle user menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>
                            {user ? user.display_name : <Skeleton className="h-5 w-24" />}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem disabled>
                                <User className="mr-2 h-4 w-4" />
                                <span>Profile</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/api/logout">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
      </header>
    )
}
