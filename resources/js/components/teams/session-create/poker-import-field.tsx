import { useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';
import { TrackerIssuePicker } from '@/components/poker/tracker-issue-picker';
import { FieldError } from '@/components/teams/session-create/field-error';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { browseErrorMessage, teamBrowseApi } from '@/lib/poker/tracker-browse';
import { TrackerLabels, isPokerTrackerSource } from '@/lib/poker/types';
import type { PokerTrackerSource } from '@/lib/poker/types';

/** The tickets a new game imports: the tracker and their external ids, in the list's order. */
export type PokerImportValue = { source: PokerTrackerSource; ids: string[] };

type PokerImportFieldProps = {
    workspaceSlug: string;
    teamId: string;
    /** The team's trackers that can import, in the order of the team's settings. */
    sources: PokerTrackerSource[];
    value: PokerImportValue;
    onChange: (value: PokerImportValue) => void;
    /** Error of the server on `import_ids` or `import_source`. */
    error?: string;
};

/** Spec plan 22 §9.3: the import tab of the poker form, browsing the team's tracker before the game exists. */
export function PokerImportField({
    workspaceSlug,
    teamId,
    sources,
    value,
    onChange,
    error,
}: PokerImportFieldProps): ReactElement {
    const { t } = useTrans();
    const api = useMemo(
        () => teamBrowseApi(workspaceSlug, teamId),
        [workspaceSlug, teamId],
    );
    const describeError = useCallback(
        (caught: unknown) => browseErrorMessage(caught, t),
        [t],
    );

    const chooseSource = (next: string): void => {
        if (!isPokerTrackerSource(next) || next === value.source) {
            return;
        }

        onChange({ source: next, ids: [] });
    };

    return (
        <div
            data-slot="poker-import-field"
            className="flex min-w-0 flex-col gap-3"
        >
            {sources.length > 1 && (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="new-poker-import-source">
                        {t('Source')}
                    </Label>
                    <Select value={value.source} onValueChange={chooseSource}>
                        <SelectTrigger
                            id="new-poker-import-source"
                            className="w-full"
                            aria-label={t('Source')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {sources.map((source) => (
                                <SelectItem key={source} value={source}>
                                    {TrackerLabels[source]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <TrackerIssuePicker
                key={value.source}
                api={api}
                source={value.source}
                selected={value.ids}
                onSelectedChange={(ids) => onChange({ ...value, ids })}
                describeError={describeError}
                idPrefix="new-poker-import"
                errorId={
                    error === undefined ? undefined : 'new-poker-import-error'
                }
            />
            <FieldError id="new-poker-import-error" message={error} />
        </div>
    );
}
