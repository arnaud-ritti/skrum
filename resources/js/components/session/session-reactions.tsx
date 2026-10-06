import { LiveReactions } from 'live-reactions/react';
import { useState } from 'react';
import type { HTMLAttributes } from 'react';
import {
    EmojiSearchDialog,
    useEmojiData,
} from '@/components/retro/emoji-picker';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import { useTrans } from '@/hooks/use-trans';
import { pushRecent } from '@/lib/emoji/recent';
import type { EmojiDataLocation } from '@/lib/games/types';
import { SessionReactionPicker } from './session-reaction-picker';
import { useFlyingReactions } from './use-flying-reactions';
import type { FlyingReactionsOptions } from './use-flying-reactions';

type SessionReactionsProps = FlyingReactionsOptions & {
    /** Name shown under a flying emoji; null hides it (anonymous retro). */
    labelFor: (senderId: string) => string | null;
    variant?: 'floating' | 'inline';
    compact?: boolean;
    /** Digits 1 to 6; false on the whiteboard, where digits pick Excalidraw tools. */
    shortcuts?: boolean;
    offsetBottom?: number;
    /** Lands on the toolbar: `whiteboard-reactions`, drag isolation handlers. */
    toolbarProps?: HTMLAttributes<HTMLDivElement>;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};

/** Callers mount it only when reactions are allowed and key it by the channel. */
export function SessionReactions({
    labelFor,
    variant = 'floating',
    compact,
    shortcuts = true,
    offsetBottom,
    toolbarProps,
    emojiData,
    ...engine
}: SessionReactionsProps) {
    const { t } = useTrans();
    const { reactions, send } = useFlyingReactions(engine);
    const hasFullList = useEmojiData(emojiData) !== null;
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) => labelFor(reaction.senderId)}
            />
            <ReactionBar
                {...toolbarProps}
                variant={variant}
                compact={compact}
                shortcuts={shortcuts}
                offsetBottom={offsetBottom}
                onReact={(emoji) => {
                    pushRecent(emoji);
                    send(emoji);
                }}
                onOpenPicker={
                    compact && hasFullList
                        ? () => setSearchOpen(true)
                        : undefined
                }
                picker={
                    hasFullList ? (
                        <SessionReactionPicker
                            onPick={send}
                            emojiData={emojiData}
                        />
                    ) : undefined
                }
            />
            <EmojiSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                label={t('Send a reaction')}
                onPick={send}
                emojiData={emojiData}
            />
        </>
    );
}
