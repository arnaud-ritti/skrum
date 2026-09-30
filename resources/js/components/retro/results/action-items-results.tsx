import { Link } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { assigneeLabel } from '@/components/action-items/assignee-select';
import { DueDateChip } from '@/components/action-items/due-date-chip';
import { PriorityIcon } from '@/components/action-items/priority-select';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from '../board-context';
import { ResultsSection } from './results-section';

export function ActionItemsResults() {
    const { board } = useBoard();
    const { actionItems: actionItemsUrl } = board.links;
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Action items')}>
            {board.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {board.actionItems.map((item) => {
                        const completed = item.status === 'completed';

                        return (
                            <li
                                key={item.id}
                                id={`action-item-${item.id}`}
                                className="flex flex-wrap items-start gap-2 rounded-md border p-2 text-sm"
                            >
                                <PriorityIcon priority={item.priority} />
                                {completed && (
                                    <Check
                                        className="mt-0.5 size-4 shrink-0"
                                        aria-label={t('Done')}
                                    />
                                )}
                                <span
                                    className={`min-w-0 flex-1 break-words ${completed ? 'text-muted-foreground line-through' : ''}`}
                                >
                                    {item.content}
                                </span>
                                <DueDateChip item={item} />
                                {item.themeName && (
                                    <Badge
                                        variant="outline"
                                        className="shrink-0 font-normal"
                                    >
                                        {t('Theme: :name', {
                                            name: item.themeName,
                                        })}
                                    </Badge>
                                )}
                                {item.assignee && (
                                    <span className="shrink-0 text-muted-foreground">
                                        {assigneeLabel(item.assignee, t)}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {actionItemsUrl && (
                <Link
                    href={actionItemsUrl}
                    className="mt-3 inline-block text-sm underline-offset-4 hover:underline"
                >
                    {t("View the team's action items")}
                </Link>
            )}
        </ResultsSection>
    );
}
