import { LiveReactions } from 'live-reactions/react';
import { SmilePlus } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { useFlyingReactions } from '@/components/session/use-flying-reactions';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { QuickEmoji } from '@/lib/retro/emoji';
import type { PresenceMember } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export {
    avatarOrigin,
    centreOrigin,
} from '@/components/session/use-flying-reactions';

type Props = {
    presence: WhisperChannel;
    selfId: string;
    online: PresenceMember[];
    labelFor: (senderId: string) => string | null;
    originFor: (senderId: string) => number;
    toolbarProps?: HTMLAttributes<HTMLDivElement>;
};

/**
 * Board-agnostic reactions bar and flying layer. Callers mount it only when
 * reactions are allowed and key it by the channel.
 */
export function FlyingReactions({
    presence,
    selfId,
    online,
    labelFor,
    originFor,
    toolbarProps,
}: Props) {
    const { t } = useTrans();
    const { reactions, send } = useFlyingReactions({
        presence,
        selfId,
        online,
        originFor,
    });

    const { className, ...restToolbarProps } = toolbarProps ?? {};

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) => labelFor(reaction.senderId)}
            />
            <div
                {...restToolbarProps}
                role="toolbar"
                aria-label={t('Reactions')}
                className={cn(
                    'fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg',
                    className,
                )}
            >
                {QuickEmoji.map((emoji) => (
                    <Button
                        key={emoji}
                        size="icon"
                        variant="ghost"
                        className="size-9 text-lg"
                        aria-label={`${t('Send a reaction')} ${emoji}`}
                        onClick={() => send(emoji)}
                    >
                        {emoji}
                    </Button>
                ))}
                <EmojiPicker
                    label={t('Send a reaction')}
                    onPick={(emoji) => send(emoji)}
                >
                    <Button size="icon" variant="ghost" className="size-9">
                        <SmilePlus className="size-4" />
                    </Button>
                </EmojiPicker>
            </div>
        </>
    );
}
