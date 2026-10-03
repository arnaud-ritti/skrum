import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import PokerImportsController from '@/actions/App/Http/Controllers/Integrations/PokerImportsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { gameBrowseApi } from '@/lib/poker/tracker-browse';
import {
    TrackerLabels,
    isPokerTrackerSource,
    type PokerTrackerSource,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { TrackerIssuePicker } from './tracker-issue-picker';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sources: PokerTrackerSource[];
};

export function ImportTasksDialog({ open, onOpenChange, sources }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-slot="poker-import" className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('Import tasks')}</DialogTitle>
                    <DialogDescription>
                        {t('Pick the issues to add to the tasks of this game.')}
                    </DialogDescription>
                </DialogHeader>
                {open && sources.length > 0 && (
                    <ImportForm
                        sources={sources}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function ImportForm({
    sources,
    onDone,
}: {
    sources: PokerTrackerSource[];
    onDone: () => void;
}) {
    const { snapshot, run, refetch, handleError } = useGame();
    const { t } = useTrans();
    const gameId = snapshot.game.id;
    const api = useMemo(() => gameBrowseApi(gameId), [gameId]);
    const [source, setSource] = useState<PokerTrackerSource>(sources[0]);
    const [selected, setSelected] = useState<string[]>([]);
    const [importing, setImporting] = useState(false);

    const chooseSource = (next: string) => {
        if (!isPokerTrackerSource(next)) {
            return;
        }

        setSource(next);
        setSelected([]);
    };

    const importSelected = async () => {
        setImporting(true);

        const result = await run(
            retroRequest<{ imported: number; skipped: number }>(
                PokerImportsController.store({ game: gameId, source }),
                { external_ids: selected },
            ),
        );

        setImporting(false);

        if (result) {
            toast.success(
                t(':imported imported, :skipped skipped.', {
                    imported: result.imported,
                    skipped: result.skipped,
                }),
            );
            await refetch();
            onDone();
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {sources.length > 1 && (
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    fullWidth
                    value={source}
                    onValueChange={chooseSource}
                    aria-label={t('Source')}
                    options={sources.map((item) => ({
                        value: item,
                        label: TrackerLabels[item],
                    }))}
                />
            )}

            <TrackerIssuePicker
                key={source}
                api={api}
                source={source}
                selected={selected}
                onSelectedChange={setSelected}
                describeError={handleError}
            />

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    className="min-w-0"
                    onClick={onDone}
                >
                    <span className="truncate">{t('Cancel')}</span>
                </Button>
                <Button
                    type="button"
                    className="min-w-0"
                    disabled={selected.length === 0 || importing}
                    onClick={() => void importSelected()}
                >
                    {importing ? (
                        <Spinner aria-hidden />
                    ) : (
                        <Download aria-hidden />
                    )}
                    <span className="truncate">
                        {t('Import :count tasks', { count: selected.length })}
                    </span>
                </Button>
            </DialogFooter>
        </div>
    );
}
