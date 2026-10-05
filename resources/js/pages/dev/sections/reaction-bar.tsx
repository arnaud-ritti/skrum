import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import type { IncomingReaction } from '@/components/skrum/reaction-bar';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Stage({
    children,
    height = 'h-48',
}: {
    children: ReactNode;
    height?: string;
}) {
    return (
        <div
            className={`relative flex ${height} w-full items-end justify-center overflow-hidden rounded-lg border border-border bg-muted/40 p-3`}
        >
            {children}
        </div>
    );
}

function burst(
    count: number,
    guestName: (index: number) => string,
): IncomingReaction[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `b${count}-${index}`,
        emoji: index % 3 === 0 ? '🎉' : '👏',
        userName: index === 0 ? 'Malik' : guestName(index),
        presence: (index % 12) + 1,
    }));
}

function Interactive() {
    const { t } = useTrans();
    const [last, setLast] = useState<string | null>(null);
    const [flying, setFlying] = useState<IncomingReaction[]>([]);
    const sent = useRef(0);

    return (
        <div className="flex flex-col gap-2">
            <Stage>
                <ReactionBar
                    variant="inline"
                    shortcuts
                    incoming={flying}
                    onOpenPicker={noop}
                    onReact={(emoji) => {
                        const id = `mine-${++sent.current}`;

                        setLast(emoji);
                        setFlying((items) => [
                            ...items.slice(-11),
                            { id, emoji, userName: t('You') },
                        ]);
                    }}
                />
            </Stage>
            <p className="text-sm">{last}</p>
        </div>
    );
}

export default function ReactionBarSection() {
    const { t } = useTrans();
    const guestName = (index: number): string =>
        t('Guest :number', { number: index });

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Interactive (keys 1 to 6, inline)')}>
                <Interactive />
            </Example>
            <Example label={t('Inline, at rest')}>
                <Stage>
                    <ReactionBar
                        variant="inline"
                        shortcuts
                        onOpenPicker={noop}
                        onReact={noop}
                    />
                </Stage>
            </Example>
            <Example label={t('Picker open')}>
                <Stage>
                    <ReactionBar
                        variant="inline"
                        pickerOpen
                        onOpenPicker={noop}
                        onReact={noop}
                    />
                </Stage>
            </Example>
            <Example label={t('Disabled with reason')}>
                <Stage>
                    <ReactionBar
                        variant="inline"
                        disabled
                        disabledReason={t('The facilitator locked reactions.')}
                        onOpenPicker={noop}
                        onReact={noop}
                    />
                </Stage>
            </Example>
            <Example label={t('Compact (mobile)')}>
                <Stage>
                    <ReactionBar variant="inline" compact onReact={noop} />
                </Stage>
            </Example>
            <Example label={t('Incoming reactions')}>
                <Stage height="h-64">
                    <ReactionBar
                        variant="inline"
                        incoming={burst(5, guestName)}
                        onReact={noop}
                    />
                </Stage>
            </Example>
            <Example label={t('Burst of 200, capped at 12 then aggregated')}>
                <Stage height="h-80">
                    <ReactionBar
                        variant="inline"
                        incoming={burst(200, guestName)}
                        onReact={noop}
                    />
                </Stage>
            </Example>
            <Example label={t('Floating above a panel (offset 6rem)')}>
                <div className="relative h-56 w-full [transform:translateZ(0)] overflow-hidden rounded-lg border border-border">
                    <ReactionBar
                        offsetBottom={6}
                        onOpenPicker={noop}
                        onReact={noop}
                    />
                    <div className="absolute inset-x-0 bottom-0 flex h-24 items-center justify-center border-t border-border bg-card text-sm">
                        {t('Deck panel')}
                    </div>
                </div>
            </Example>
        </div>
    );
}
