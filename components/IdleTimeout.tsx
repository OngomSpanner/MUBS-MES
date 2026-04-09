"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function IdleTimeout() {
    const router = useRouter();
    const pathname = usePathname();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 15 minutes in milliseconds
    const TIMEOUT_MS = 15 * 60 * 1000;

    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed', error);
            window.location.href = '/';
        }
    }, []);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Only set timeout if we are not on the login page
        if (pathname !== '/') {
            timeoutRef.current = setTimeout(() => {
                handleLogout();
            }, TIMEOUT_MS);
        }
    }, [handleLogout, pathname, TIMEOUT_MS]);

    useEffect(() => {
        // Events that reset the idle timer
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

        const handleUserActivity = () => {
            resetTimer();
        };

        // Attach event listeners
        events.forEach((event) => {
            window.addEventListener(event, handleUserActivity);
        });

        // Initialize timer
        resetTimer();

        return () => {
            // Cleanup event listeners
            events.forEach((event) => {
                window.removeEventListener(event, handleUserActivity);
            });
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [resetTimer]);

    return null; // This component doesn't render anything
}
