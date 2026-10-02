import {
    createContext,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from 'react';
import type { PickedGif } from '@/components/gifs/gif-search-dialog';

type Draft = { roundId: string; gif: PickedGif };

type GifDraftValue = {
    draft: Draft | null;
    setDraft: (draft: Draft | null) => void;
    pickerRef: RefObject<HTMLDivElement | null>;
};

const GifDraftContext = createContext<GifDraftValue | null>(null);

/**
 * The GIF a player picked on the stage and has not sent: the picker and
 * "Your pick" stand in two columns and share it. It never leaves the browser.
 */
export function GifDraftProvider({ children }: { children: ReactNode }) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const value = useMemo(() => ({ draft, setDraft, pickerRef }), [draft]);

    return <GifDraftContext value={value}>{children}</GifDraftContext>;
}

type GifDraft = {
    /** Null when nothing is picked, or when the pick belongs to another round. */
    draft: PickedGif | null;
    pick: (gif: PickedGif) => void;
    clear: () => void;
    /** Wraps the picker on the stage. */
    pickerRef: RefObject<HTMLDivElement | null>;
    /** Sends the keyboard back to the search of the picker. */
    focusPicker: () => void;
};

export function useGifDraft(roundId: string): GifDraft {
    const value = useContext(GifDraftContext);

    if (!value) {
        throw new Error('useGifDraft() must be used inside <RoomProvider>.');
    }

    const { draft, setDraft, pickerRef } = value;

    return {
        draft: draft?.roundId === roundId ? draft.gif : null,
        pick: (gif) => setDraft({ roundId, gif }),
        clear: () => setDraft(null),
        pickerRef,
        focusPicker: () => {
            const search = pickerRef.current?.querySelector<HTMLInputElement>(
                'input[type="search"]',
            );

            search?.focus();
        },
    };
}
