import { useId, useState } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { PlayersList } from './players-list';
import { RoomScores } from './room-scores';

type Tab = 'players' | 'scores';

export function RoomSidebar({
    highlightPlayerId,
}: {
    highlightPlayerId: string | null;
}) {
    const { t } = useTrans();
    const id = useId();
    const [tab, setTab] = useState<Tab>('players');
    const tabs: { value: Tab; label: string }[] = [
        { value: 'players', label: t('Players') },
        { value: 'scores', label: t('Scores') },
    ];

    return (
        <div className="space-y-3">
            <div role="tablist" className="flex gap-1 rounded-md bg-muted p-1">
                {tabs.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        id={`${id}-${item.value}`}
                        aria-selected={tab === item.value}
                        aria-controls={`${id}-panel`}
                        className={cn(
                            'flex-1 rounded px-2 py-1 text-sm',
                            tab === item.value && 'bg-background shadow-sm',
                        )}
                        onClick={() => setTab(item.value)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={`${id}-${tab}`}
            >
                {tab === 'players' ? (
                    <PlayersList highlightPlayerId={highlightPlayerId} />
                ) : (
                    <RoomScores />
                )}
            </div>
        </div>
    );
}
