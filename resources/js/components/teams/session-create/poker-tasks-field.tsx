import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';

export const MaxPokerTasks = 50;
export const MaxPokerTaskTitleLength = 200;

export type PokerTasksMode = 'type' | 'later';

export type PokerTasksValue = { mode: PokerTasksMode; text: string };

export type PokerTasksFieldProps = {
    value: PokerTasksValue;
    onChange: (value: PokerTasksValue) => void;
    /** Error of the server on `tasks` or one of its lines. */
    error?: string;
    /** Id of the text area. */
    id?: string;
};

export function emptyPokerTasks(): PokerTasksValue {
    return { mode: 'later', text: '' };
}

function typedLines(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

/** The queue the game starts with: one title per line, none when the tasks come later. */
export function taskTitles(value: PokerTasksValue): string[] {
    return value.mode === 'type' ? typedLines(value.text) : [];
}

export function tasksProblem(
    value: PokerTasksValue,
): 'tooMany' | 'tooLong' | null {
    const titles = taskTitles(value);

    if (titles.length > MaxPokerTasks) {
        return 'tooMany';
    }

    if (
        titles.some(
            (title) => Array.from(title).length > MaxPokerTaskTitleLength,
        )
    ) {
        return 'tooLong';
    }

    return null;
}

type TaskTab = { value: PokerTasksMode; label: string; icon?: LucideIcon };

/**
 * The tasks of a new game: typed now, one per line, or added later in the
 * room. The ways come from a list, so that another one takes its tab without
 * moving these.
 */
export function PokerTasksField({
    value,
    onChange,
    error,
    id = 'new-poker-tasks',
}: PokerTasksFieldProps): ReactElement {
    const { t } = useTrans();
    const tabs: TaskTab[] = [
        { value: 'type', label: t('Type them') },
        { value: 'later', label: t('Later') },
    ];
    const count = typedLines(value.text).length;
    const problem = tasksProblem(value);
    const problemMessage =
        problem === 'tooMany'
            ? t('A game starts with :count tasks at most.', {
                  count: MaxPokerTasks,
              })
            : problem === 'tooLong'
              ? t('A task title has :count characters at most.', {
                    count: MaxPokerTaskTitleLength,
                })
              : undefined;
    const message = problemMessage ?? error;

    return (
        <Tabs
            value={value.mode}
            onValueChange={(mode) => onChange({ ...value, mode })}
            data-slot="poker-tasks"
            className="gap-2"
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span
                    id={`${id}-label`}
                    className="truncate text-sm font-semibold"
                >
                    {t('Tasks')}
                </span>
                <TabsList aria-label={t('Tasks')} className="shrink-0">
                    {tabs.map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            icon={tab.icon}
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            <TabsContent value="type" className="flex flex-col gap-1.5">
                <Textarea
                    id={id}
                    value={value.text}
                    rows={5}
                    aria-label={t('Tasks, one per line')}
                    aria-invalid={message !== undefined || undefined}
                    aria-describedby={`${id}-count ${id}-error`}
                    placeholder={t('One task per line')}
                    className="max-h-48 min-h-28 resize-y"
                    onChange={(event) =>
                        onChange({ ...value, text: event.target.value })
                    }
                />
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <p
                        id={`${id}-error`}
                        role={message === undefined ? undefined : 'alert'}
                        className="min-w-0 text-xs text-skrum-destructive-text"
                    >
                        {message}
                    </p>
                    <p
                        id={`${id}-count`}
                        className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    >
                        {t(':count / :max tasks', {
                            count,
                            max: MaxPokerTasks,
                        })}
                    </p>
                </div>
            </TabsContent>
            <TabsContent value="later">
                <p className="rounded-lg border border-dashed px-3 py-2.5 text-body-sm text-muted-foreground">
                    {t('Add the tasks in the room, once the game is open.')}
                </p>
                {error !== undefined && (
                    <p
                        role="alert"
                        className="mt-1.5 text-xs text-skrum-destructive-text"
                    >
                        {error}
                    </p>
                )}
            </TabsContent>
        </Tabs>
    );
}
