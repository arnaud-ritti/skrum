import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type CompletedView = 'results' | 'board';

type Props = {
    value: CompletedView;
    onChange: (view: CompletedView) => void;
};

const Views: Array<{ view: CompletedView; label: string }> = [
    { view: 'results', label: 'Results' },
    { view: 'board', label: 'Board' },
];

export const CompletedPanelId = 'completed-view-panel';

export function CompletedTabId(view: CompletedView): string {
    return `completed-tab-${view}`;
}

export function CompletedTabs({ value, onChange }: Props) {
    const { t } = useTrans();

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
            return;
        }

        event.preventDefault();

        const next = value === 'results' ? 'board' : 'results';

        onChange(next);
        document.getElementById(CompletedTabId(next))?.focus();
    }

    return (
        <div
            role="tablist"
            aria-label={t('Retrospective views')}
            className="flex gap-1 border-b px-4 py-2"
        >
            {Views.map(({ view, label }) => (
                <Button
                    key={view}
                    id={CompletedTabId(view)}
                    role="tab"
                    size="sm"
                    variant={value === view ? 'secondary' : 'ghost'}
                    aria-selected={value === view}
                    aria-controls={CompletedPanelId}
                    tabIndex={value === view ? 0 : -1}
                    onKeyDown={handleKeyDown}
                    onClick={() => onChange(view)}
                >
                    {t(label)}
                </Button>
            ))}
        </div>
    );
}
