import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** Beyond this many questions the segments would be too thin to read. */
const MaxSegments = 12;

/** "Question n of N" over the mockup's segments, or over a bar for a long survey. */
export function SurveyProgress({
    index,
    count,
}: {
    /** The current question, from 0. */
    index: number;
    count: number;
}) {
    const { t } = useTrans();
    const label = t('Question :index of :count', { index: index + 1, count });

    if (count > MaxSegments) {
        return <Progress value={index + 1} max={count} label={label} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
                {label}
            </span>
            <div
                aria-hidden="true"
                data-slot="survey-progress-segments"
                className="flex gap-1.5"
            >
                {Array.from({ length: count }, (_, segment) => {
                    const state =
                        segment < index
                            ? 'done'
                            : segment === index
                              ? 'current'
                              : 'todo';

                    return (
                        <i
                            key={segment}
                            data-state={state}
                            className={cn(
                                'block h-1.5 max-w-7 flex-1 rounded-full bg-border',
                                state === 'done' && 'bg-primary',
                                state === 'current' && 'bg-primary/45',
                            )}
                        />
                    );
                })}
            </div>
        </div>
    );
}
