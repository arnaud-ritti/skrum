import { ArrowLeft, History } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import { roundTitle } from '@/lib/games/round-title';
import { useRoom } from './room-context';
import { RoundDetail } from './round-detail';

/** The rounds already played in the room, and one of them in detail. */
export function HistoryDrawer() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [roundId, setRoundId] = useState<string | null>(null);
    const restoreFocus = useRestoreFocus(open);

    return (
        <>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(true)}
            >
                <History aria-hidden />
                <span className="truncate">{t('History')}</span>
            </Button>
            <Sheet
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    setRoundId(null);
                }}
            >
                <SheetContent
                    side="right"
                    aria-describedby={undefined}
                    onCloseAutoFocus={restoreFocus}
                >
                    <SheetHeader>
                        <SheetTitle>{t('Last rounds')}</SheetTitle>
                    </SheetHeader>
                    <SheetBody>
                        {roundId !== null ? (
                            <div className="flex flex-col gap-4">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="self-start"
                                    onClick={() => setRoundId(null)}
                                >
                                    <ArrowLeft aria-hidden />
                                    <span className="truncate">
                                        {t('Back')}
                                    </span>
                                </Button>
                                <RoundDetail roundId={roundId} />
                            </div>
                        ) : snapshot.history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t('No rounds played yet.')}
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {snapshot.history.map((round) => (
                                    <li key={round.id}>
                                        <button
                                            type="button"
                                            className="flex w-full min-w-0 items-center gap-3 rounded-lg border bg-card p-3 text-left outline-ring hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                                            onClick={() => setRoundId(round.id)}
                                        >
                                            <span className="min-w-0 flex-1 truncate font-medium">
                                                {roundTitle(round, t)}
                                            </span>
                                            <Badge
                                                variant="secondary"
                                                shape="pill"
                                            >
                                                {outcomeLabel(round.outcome, t)}
                                            </Badge>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SheetBody>
                </SheetContent>
            </Sheet>
        </>
    );
}
