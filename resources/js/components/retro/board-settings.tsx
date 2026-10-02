import { useState } from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import {
    SessionSettingsPopover,
    useRetroSettingGroups,
} from '@/components/skrum/session-settings-popover';
import type { RetroSettingsValues } from '@/components/skrum/session-settings-popover';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { Snapshot } from '@/lib/retro/types';
import { useBoard } from './board-context';

/** The retro as the settings endpoint names its fields. */
export function retroSettingsValues(
    retro: Snapshot['retro'],
): RetroSettingsValues {
    return {
        title: retro.title,
        is_anonymous: retro.isAnonymous,
        votes_per_participant: retro.votesAuto
            ? null
            : retro.votesPerParticipant,
        health_check_enabled: retro.healthCheckEnabled,
        icebreaker_enabled: retro.icebreakerEnabled,
        icebreaker_game: retro.icebreakerGame,
        reactions_enabled: retro.reactionsEnabled,
        cursors_enabled: retro.cursorsEnabled,
        gifs_enabled: retro.gifsEnabled,
        hide_vote_counts: retro.hideVoteCounts,
        is_locked: retro.isLocked,
        presentation_mode: retro.presentationMode,
        ai_summary_enabled: retro.aiSummaryEnabled,
    };
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The settings button of the header: the popover hangs under it. */
    anchorRef?: RefObject<HTMLElement | null>;
    variant?: 'popover' | 'sheet' | 'drawer';
};

export function BoardSettings({
    open,
    onOpenChange,
    anchorRef,
    variant,
}: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { board } = ctx;
    const { retro } = board;
    const [draft, setDraft] = useState<Partial<RetroSettingsValues>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const groups = useRetroSettingGroups({
        phase: retro.phase,
        isAnonymous: retro.isAnonymous,
        icebreakerGame: retro.icebreakerGame,
        votesPerParticipant: retro.votesPerParticipant,
        hasCards: board.cards.length > 0,
        icebreakerGames: board.icebreakerGames,
        gifProvider: retro.gifProvider,
        llmProvider: board.features.llm ? board.features.llmProvider : null,
    });

    const facilitator = board.participants.find(
        (participant) => participant.id === retro.facilitatorParticipantId,
    );

    const apply = async (patch: Partial<RetroSettingsValues>) => {
        setErrors({});

        try {
            await retroRequest(RetroSettingsController.update(retro.id), patch);
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message === null) {
                onOpenChange(false);

                throw caught;
            }

            const fields =
                caught instanceof RetroRequestError
                    ? Object.entries(caught.errors)
                    : [];

            if (fields.length === 0) {
                toast.error(message);
            }

            setErrors(
                Object.fromEntries(
                    fields.map(([key, messages]) => [key, messages[0]]),
                ),
            );

            throw caught;
        }

        await ctx.refetch();
    };

    return (
        <SessionSettingsPopover<RetroSettingsValues>
            open={open && !ctx.sessionExpired}
            onOpenChange={onOpenChange}
            title={t('Retrospective settings')}
            sessionTitle={retro.title}
            phase={retro.phase}
            groups={groups}
            value={retroSettingsValues(retro)}
            draft={draft}
            onDraftChange={setDraft}
            errors={errors}
            readOnly={!board.viewer.isFacilitator}
            facilitatorName={facilitator?.name}
            onApply={apply}
            onReset={() => {
                setDraft({});
                setErrors({});
            }}
            variant={variant}
            anchorRef={anchorRef}
        />
    );
}
