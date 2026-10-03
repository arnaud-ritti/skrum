import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { PokerTaskExternal } from '@/lib/poker/types';
import { MarkdownClasses } from './markdown-classes';

const MaxLabels = 10;

/** The ticket's type and labels, as its tracker names them; nothing for what it lacks. */
export function TicketChips({
    external,
}: {
    external: PokerTaskExternal | null;
}) {
    if (!external) {
        return null;
    }

    const labels = external.labels.slice(0, MaxLabels);

    if (!external.type && labels.length === 0) {
        return null;
    }

    return (
        <>
            {external.type && (
                <Badge variant="outline" data-slot="ticket-type">
                    {external.type}
                </Badge>
            )}
            {labels.map((label, index) => (
                <Badge
                    key={`${index}:${label}`}
                    variant="muted"
                    data-slot="ticket-label"
                >
                    {label}
                </Badge>
            ))}
        </>
    );
}

/** The description's "Acceptance criteria" section, under the app's own heading. */
export function TicketCriteria({ html }: { html: string }) {
    const { t } = useTrans();

    if (html === '') {
        return null;
    }

    return (
        <div data-slot="ticket-criteria" className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-muted-foreground">
                {t('Acceptance criteria')}
            </h3>
            <div
                className={MarkdownClasses}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
