import { useState, type FormEvent } from 'react';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { AiSummarySwitch } from './ai-summary-switch';
import { useBoard } from './board-context';
import { IcebreakerGameSelect } from './icebreaker-game-select';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && <SettingsForm onDone={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function SettingCheckbox({
    id,
    label,
    checked,
    disabled,
    onChange,
}: {
    id: string;
    label: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => onChange(value === true)}
            />
            <Label htmlFor={id}>{label}</Label>
        </div>
    );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro } = ctx.board;
    const [title, setTitle] = useState(retro.title);
    const [isAnonymous, setIsAnonymous] = useState(retro.isAnonymous);
    const [votesAuto, setVotesAuto] = useState(retro.votesAuto);
    const [votes, setVotes] = useState(String(retro.votesPerParticipant));
    const [healthCheckEnabled, setHealthCheckEnabled] = useState(
        retro.healthCheckEnabled,
    );
    const [icebreakerEnabled, setIcebreakerEnabled] = useState(
        retro.icebreakerEnabled,
    );
    const [icebreakerGame, setIcebreakerGame] = useState(retro.icebreakerGame);
    const [reactionsEnabled, setReactionsEnabled] = useState(
        retro.reactionsEnabled,
    );
    const [cursorsEnabled, setCursorsEnabled] = useState(retro.cursorsEnabled);
    const [gifsEnabled, setGifsEnabled] = useState(retro.gifsEnabled);
    const [hideVoteCounts, setHideVoteCounts] = useState(retro.hideVoteCounts);
    const [isLocked, setIsLocked] = useState(retro.isLocked);
    const [presentationMode, setPresentationMode] = useState(
        retro.presentationMode,
    );
    const [aiSummaryEnabled, setAiSummaryEnabled] = useState(
        retro.aiSummaryEnabled,
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const anonymityLocked = retro.isAnonymous && ctx.board.cards.length > 0;
    const votesLocked = ![
        'health_check',
        'icebreaker',
        'writing',
        'grouping',
    ].includes(retro.phase);
    const engagementLocked = retro.phase === 'completed';

    const save = async (event: FormEvent) => {
        event.preventDefault();

        const changes: Record<string, unknown> = {};

        if (title !== retro.title) {
            changes.title = title;
        }

        if (isAnonymous !== retro.isAnonymous) {
            changes.is_anonymous = isAnonymous;
        }

        const votesChanged =
            votesAuto !== retro.votesAuto ||
            (!votesAuto && Number(votes) !== retro.votesPerParticipant);

        if (votesChanged) {
            changes.votes_per_participant = votesAuto ? null : Number(votes);
        }

        if (healthCheckEnabled !== retro.healthCheckEnabled) {
            changes.health_check_enabled = healthCheckEnabled;
        }

        if (icebreakerEnabled !== retro.icebreakerEnabled) {
            changes.icebreaker_enabled = icebreakerEnabled;
        }

        if (icebreakerGame !== retro.icebreakerGame) {
            changes.icebreaker_game = icebreakerGame;
        }

        if (reactionsEnabled !== retro.reactionsEnabled) {
            changes.reactions_enabled = reactionsEnabled;
        }

        if (cursorsEnabled !== retro.cursorsEnabled) {
            changes.cursors_enabled = cursorsEnabled;
        }

        if (gifsEnabled !== retro.gifsEnabled) {
            changes.gifs_enabled = gifsEnabled;
        }

        if (hideVoteCounts !== retro.hideVoteCounts) {
            changes.hide_vote_counts = hideVoteCounts;
        }

        if (isLocked !== retro.isLocked) {
            changes.is_locked = isLocked;
        }

        if (presentationMode !== retro.presentationMode) {
            changes.presentation_mode = presentationMode;
        }

        if (aiSummaryEnabled !== retro.aiSummaryEnabled) {
            changes.ai_summary_enabled = aiSummaryEnabled;
        }

        if (Object.keys(changes).length === 0) {
            onDone();

            return;
        }

        setSaving(true);
        setError(null);

        try {
            await retroRequest(
                RetroSettingsController.update(retro.id),
                changes,
            );
            await ctx.refetch();
            onDone();
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message === null) {
                onDone();

                return;
            }

            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
            <DialogTitle>{t('Retrospective settings')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="retro-title">{t('Title')}</Label>
                <Input
                    id="retro-title"
                    value={title}
                    maxLength={120}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                />
            </div>

            <div className="grid gap-1">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="retro-anonymous"
                        checked={isAnonymous}
                        disabled={anonymityLocked}
                        onCheckedChange={(checked) =>
                            setIsAnonymous(checked === true)
                        }
                    />
                    <Label htmlFor="retro-anonymous">
                        {t('Anonymous cards')}
                    </Label>
                </div>
                {anonymityLocked && (
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'Anonymity can only be turned off before any card is written.',
                        )}
                    </p>
                )}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="retro-votes">
                    {t('Votes per participant')}
                </Label>
                <SettingCheckbox
                    id="retro-votes-auto"
                    label={t('Automatic vote limit')}
                    checked={votesAuto}
                    disabled={votesLocked}
                    onChange={setVotesAuto}
                />
                {votesAuto ? (
                    <p className="text-xs text-muted-foreground">
                        {t('Automatic: number of cards plus 3, at most 10.')}
                    </p>
                ) : (
                    <Input
                        id="retro-votes"
                        type="number"
                        min={1}
                        max={20}
                        value={votes}
                        disabled={votesLocked}
                        onChange={(event) => setVotes(event.target.value)}
                    />
                )}
            </div>

            <div className="grid gap-2">
                <SettingCheckbox
                    id="retro-health-check"
                    label={t('Health check')}
                    checked={healthCheckEnabled}
                    disabled={
                        engagementLocked || retro.phase === 'health_check'
                    }
                    onChange={setHealthCheckEnabled}
                />
                <SettingCheckbox
                    id="retro-icebreaker"
                    label={t('Icebreaker')}
                    checked={icebreakerEnabled}
                    disabled={engagementLocked || retro.phase === 'icebreaker'}
                    onChange={setIcebreakerEnabled}
                />
                {icebreakerEnabled && (
                    <IcebreakerGameSelect
                        id="retro-icebreaker-game"
                        value={icebreakerGame}
                        options={ctx.board.icebreakerGames}
                        disabled={engagementLocked}
                        onChange={setIcebreakerGame}
                    />
                )}
            </div>

            <div className="grid gap-2">
                <SettingCheckbox
                    id="retro-reactions"
                    label={t('Show reactions')}
                    checked={reactionsEnabled}
                    disabled={engagementLocked}
                    onChange={setReactionsEnabled}
                />
                <SettingCheckbox
                    id="retro-cursors"
                    label={t('Show live cursors')}
                    checked={cursorsEnabled}
                    disabled={engagementLocked}
                    onChange={setCursorsEnabled}
                />
                {retro.gifProvider !== null && (
                    <SettingCheckbox
                        id="retro-gifs"
                        label={t('Allow GIFs')}
                        checked={gifsEnabled}
                        disabled={engagementLocked}
                        onChange={setGifsEnabled}
                    />
                )}
                <SettingCheckbox
                    id="retro-hide-vote-counts"
                    label={t('Hide vote counts')}
                    checked={hideVoteCounts}
                    disabled={engagementLocked}
                    onChange={setHideVoteCounts}
                />
                <SettingCheckbox
                    id="retro-locked"
                    label={t('Close for editing')}
                    checked={isLocked}
                    disabled={engagementLocked}
                    onChange={setIsLocked}
                />
                <SettingCheckbox
                    id="retro-presentation"
                    label={t('Presentation mode')}
                    checked={presentationMode}
                    disabled={engagementLocked}
                    onChange={setPresentationMode}
                />
            </div>

            {ctx.board.features.llm && ctx.board.features.llmProvider && (
                <AiSummarySwitch
                    id="retro-ai-summary"
                    provider={ctx.board.features.llmProvider}
                    checked={aiSummaryEnabled}
                    disabled={engagementLocked}
                    onChange={setAiSummaryEnabled}
                />
            )}

            <InputError message={error ?? undefined} />

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
