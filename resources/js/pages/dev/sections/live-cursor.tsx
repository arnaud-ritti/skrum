import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    CursorLayer,
    LiveCursor,
    type LiveCursorProps,
} from '@/components/skrum/live-cursor';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Board({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`relative h-40 overflow-hidden rounded-xl border bg-muted ${className ?? ''}`}
        >
            {children}
        </div>
    );
}

function Toggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 p-4 text-sm">
            {label}
            <Switch
                checked={checked}
                onCheckedChange={onChange}
                aria-label={label}
            />
        </div>
    );
}

export default function LiveCursorSection() {
    const { t } = useTrans();
    const [visible, setVisible] = useState(true);
    const [shareMine, setShareMine] = useState(true);
    const viewport = { x: 0, y: 0, zoom: 1 };
    const cursors: LiveCursorProps[] = [
        { userId: 'a', name: 'Camille', presence: 4, x: 80, y: 40 },
        {
            userId: 'b',
            name: 'Inès',
            presence: 9,
            x: 190,
            y: 90,
            action: 'dragging',
        },
        { userId: 'c', name: 'Théo', presence: 2, x: 200, y: 20, idle: true },
        {
            userId: 'd',
            name: t('Thoughtful otter'),
            presence: 11,
            x: 40,
            y: 110,
        },
    ];

    return (
        <div className="flex max-w-240 flex-col gap-6 p-6">
            <State label={t('Simple cursor')}>
                <Board>
                    <LiveCursor
                        userId="a"
                        name="Camille"
                        presence={4}
                        x={40}
                        y={30}
                    />
                </Board>
            </State>
            <State label={t('Dragging cursor')}>
                <Board>
                    <div className="absolute top-8 left-24 w-40 -rotate-3 rounded-lg bg-card p-3 text-sm shadow-drag">
                        {t('Follow-up emails to review')}
                    </div>
                    <LiveCursor
                        userId="b"
                        name="Inès"
                        presence={9}
                        x={180}
                        y={90}
                        action="dragging"
                    />
                </Board>
            </State>
            <State label={t('Drawing and typing')}>
                <Board>
                    <LiveCursor
                        userId="e"
                        name="Léa"
                        presence={6}
                        x={30}
                        y={30}
                        action="drawing"
                    />
                    <LiveCursor
                        userId="f"
                        name="Hugo"
                        presence={1}
                        x={200}
                        y={80}
                        action="typing"
                    />
                </Board>
            </State>
            <State label={t('Idle cursor (arrow only)')}>
                <Board>
                    <LiveCursor
                        userId="c"
                        name="Théo"
                        presence={2}
                        x={40}
                        y={30}
                        idle
                    />
                </Board>
            </State>
            <State label={t('Guest cursor (nickname, long name truncated)')}>
                <Board>
                    <LiveCursor
                        userId="d"
                        name={t('Thoughtful otter')}
                        presence={11}
                        x={40}
                        y={30}
                    />
                    <LiveCursor
                        userId="g"
                        name="Un pseudo vraiment très long"
                        presence={7}
                        x={40}
                        y={90}
                    />
                </Board>
            </State>
            <State label={t('Shared board with display settings')}>
                <div className="@container grid gap-4 md:grid-cols-[1fr_16rem]">
                    <Board className="h-56">
                        <CursorLayer
                            cursors={cursors}
                            visible={visible}
                            viewport={viewport}
                            className={
                                visible ? undefined : 'absolute bottom-2 left-2'
                            }
                        />
                    </Board>
                    <Card className="gap-0 p-0">
                        <Toggle
                            label={t('Show cursors')}
                            checked={visible}
                            onChange={setVisible}
                        />
                        <div className="border-t" />
                        <Toggle
                            label={t('Share my cursor')}
                            checked={shareMine}
                            onChange={setShareMine}
                        />
                    </Card>
                </div>
            </State>
        </div>
    );
}
