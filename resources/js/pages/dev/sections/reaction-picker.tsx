import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    ReactionPicker,
    ReactionPickerGrid,
} from '@/components/skrum/reaction-picker';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const emojis = [
    '👍',
    '❤️',
    '👏',
    '🎉',
    '🤔',
    '👎',
    '😂',
    '👀',
    '🔥',
    '💡',
    '😮',
    '🙏',
];

function emojiRange(start: number, length: number): string[] {
    return Array.from({ length }, (_, index) =>
        String.fromCodePoint(start + index),
    );
}

const manyEmojis = [
    ...emojiRange(0x1f600, 80),
    ...emojiRange(0x1f400, 64),
    ...emojiRange(0x1f330, 56),
];

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

/** The popover panel in the page flow: no portal, no focus trap. */
function Panel({ children }: { children: ReactNode }) {
    return (
        <div className="w-fit max-w-80 rounded-lg border bg-popover p-2 text-popover-foreground shadow-popover">
            {children}
        </div>
    );
}

function Grid({ list, initial }: { list: string[]; initial: string[] }) {
    const [mine, setMine] = useState(initial);

    return (
        <Panel>
            <ReactionPickerGrid
                emojis={list}
                mine={mine}
                onToggle={(emoji) =>
                    setMine((current) =>
                        current.includes(emoji)
                            ? current.filter((item) => item !== emoji)
                            : [...current, emoji],
                    )
                }
            />
        </Panel>
    );
}

function OpenPicker() {
    const { t } = useTrans();
    const [mine, setMine] = useState(['🎉', '🔥']);

    return (
        <div className="flex h-56 items-start">
            <ReactionPicker
                defaultOpen
                side="bottom"
                align="start"
                emojis={emojis}
                mine={mine}
                onToggle={(emoji) =>
                    setMine((current) =>
                        current.includes(emoji)
                            ? current.filter((item) => item !== emoji)
                            : [...current, emoji],
                    )
                }
                trigger={
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t('Add a reaction')}
                    >
                        <SmilePlus aria-hidden />
                    </Button>
                }
            />
        </div>
    );
}

export default function ReactionPickerSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t('Real popover, open below its trigger (two chosen)')}
            >
                <div className="pb-28">
                    <OpenPicker />
                </div>
            </Example>
            <Example label={t('Grid: 12 emoji, none chosen (arrow keys move)')}>
                <Grid list={emojis} initial={[]} />
            </Example>
            <Example label={t('Grid: two already chosen')}>
                <Grid list={emojis} initial={['❤️', '👀']} />
            </Example>
            <Example label={t('Grid: every emoji chosen')}>
                <Grid list={emojis.slice(0, 6)} initial={emojis.slice(0, 6)} />
            </Example>
            <Example label={t('Grid: one emoji')}>
                <Grid list={['🎉']} initial={[]} />
            </Example>
            <Example label={t('Grid: no emoji')}>
                <Grid list={[]} initial={[]} />
            </Example>
            <Example label={t('Grid: 200 emoji (scrolls inside the panel)')}>
                <Grid list={manyEmojis} initial={[manyEmojis[3]]} />
            </Example>
        </div>
    );
}
