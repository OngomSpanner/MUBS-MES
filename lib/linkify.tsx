"use client";

import React from 'react';

const FILE_LINK_LABEL = 'Download document';

/**
 * Renders text with:
 * - http:// and https:// URLs as clickable links (shows URL, opens in new tab).
 * - /uploads/... file paths as clickable links with friendly text "Download document" (opens/downloads file; path is not shown).
 */
export function linkify(text: string | null | undefined): React.ReactNode {
    if (text == null || typeof text !== 'string') return text ?? '';
    const parts: React.ReactNode[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)|(\/uploads\/[^\s]*)/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(<span key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</span>);
        }
        const raw = match[0];
        const isFilePath = raw.startsWith('/uploads/');
        if (isFilePath) {
            parts.push(
                <a
                    key={`a-${key++}`}
                    href={raw}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="text-primary text-decoration-underline"
                >
                    {FILE_LINK_LABEL}
                </a>
            );
        } else {
            parts.push(
                <a key={`a-${key++}`} href={raw} target="_blank" rel="noopener noreferrer" className="text-primary text-break">{raw}</a>
            );
        }
        lastIndex = urlRegex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(<span key={`t-${key++}`}>{text.slice(lastIndex)}</span>);
    }
    return parts.length <= 1 ? (parts[0] ?? text) : <>{parts}</>;
}
