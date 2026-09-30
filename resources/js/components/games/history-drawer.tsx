import { History } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import { useRoom } from './room-context';
import { RoundDetail } from './round-detail';

export function HistoryDrawer() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [roundId, setRoundId] = useState<string | null>(null);

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                setRoundId(null);
            }}
        >
            <SheetTrigger asChild>
                <Button size="sm" variant="outline">
                    <History className="size-4" />
                    {t('History')}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-4 p-4 sm:max-w-md">
                <SheetTitle>{t('Last rounds')}</SheetTitle>
                {roundId !== null ? (
                    <div className="space-y-4">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRoundId(null)}
                        >
                            {t('Back')}
                        </Button>
                        <RoundDetail roundId={roundId} />
                    </div>
                ) : snapshot.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No rounds played yet.')}
                    </p>
                ) : (
                    <ul className="space-y-2 overflow-y-auto">
                        {snapshot.history.map((round) => (
                            <li key={round.id}>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted"
                                    onClick={() => setRoundId(round.id)}
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {round.word ?? round.question ?? '—'}
                                    </span>
                                    <Badge variant="secondary">
                                        {outcomeLabel(round.outcome, t)}
                                    </Badge>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </SheetContent>
        </Sheet>
    );
}
