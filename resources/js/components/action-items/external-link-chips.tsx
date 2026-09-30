import { ArrowUpRight } from 'lucide-react';
import type { ExternalLink } from '@/types';

type Props = {
    links: ExternalLink[] | null;
};

export function ExternalLinkChips({ links }: Props) {
    if (links === null || links.length === 0) {
        return null;
    }

    return (
        <>
            {links.map((link) => (
                <a
                    key={link.source}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-muted"
                >
                    {link.key}
                    <ArrowUpRight className="size-3" aria-hidden />
                </a>
            ))}
        </>
    );
}
