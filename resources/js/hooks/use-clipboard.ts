// Credit: https://usehooks-ts.com/
import { useEffect, useState } from 'react';

type CopiedValue = string | null;
type CopyFn = (text: string) => Promise<boolean>;
export type UseClipboardReturn = [CopiedValue, CopyFn];

/** With `resetMs`, the copied text is forgotten that long after a copy. */
export function useClipboard({
    resetMs,
}: { resetMs?: number } = {}): UseClipboardReturn {
    const [copiedText, setCopiedText] = useState<CopiedValue>(null);

    useEffect(() => {
        if (resetMs === undefined || copiedText === null) {
            return;
        }

        const timer = window.setTimeout(() => setCopiedText(null), resetMs);

        return () => window.clearTimeout(timer);
    }, [copiedText, resetMs]);

    const copy: CopyFn = async (text) => {
        if (!navigator?.clipboard) {
            console.warn('Clipboard not supported');

            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);

            return true;
        } catch (error) {
            console.warn('Copy failed', error);
            setCopiedText(null);

            return false;
        }
    };

    return [copiedText, copy];
}
