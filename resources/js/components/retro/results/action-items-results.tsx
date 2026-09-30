import { Check } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from '../board-context';
import { ResultsSection } from './results-section';

export function ActionItemsResults() {
    const { board } = useBoard();
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Action items')}>
            {board.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {board.actionItems.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-md border p-2 text-sm"
                        >
                            {item.isDone && (
                                <Check
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-label={t('Done')}
                                />
                            )}
                            <span
                                className={`min-w-0 flex-1 break-words ${item.isDone ? 'text-muted-foreground line-through' : ''}`}
                            >
                                {item.content}
                            </span>
                            {item.assignee && (
                                <span className="shrink-0 text-muted-foreground">
                                    {item.assignee.name}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </ResultsSection>
    );
}
