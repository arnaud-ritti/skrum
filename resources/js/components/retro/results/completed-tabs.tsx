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

export function CompletedTabs({ value, onChange }: Props) {
    const { t } = useTrans();

    return (
        <div role="tablist" className="flex gap-1 border-b px-4 py-2">
            {Views.map(({ view, label }) => (
                <Button
                    key={view}
                    role="tab"
                    size="sm"
                    variant={value === view ? 'secondary' : 'ghost'}
                    aria-selected={value === view}
                    onClick={() => onChange(view)}
                >
                    {t(label)}
                </Button>
            ))}
        </div>
    );
}
