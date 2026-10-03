import { useState } from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import RetroHealthChecksController from '@/actions/App/Http/Controllers/Retros/RetroHealthChecksController';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import {
    SessionSettingsPopover,
    useRetroSettingGroups,
} from '@/components/skrum/session-settings-popover';
import type {
    RetroSettingsValues,
    SessionSettingGroup,
    StepperSetting,
    SurveyKind,
} from '@/components/skrum/session-settings-popover';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    MaxPhaseMinutes,
    TimedPhases,
    choiceOf,
    customStart,
    durationsFor,
    summary,
} from '@/lib/retro/phase-durations';
import type {
    PhaseDurations,
    PhaseTimerChoice,
    TimedPhase,
} from '@/lib/retro/phase-durations';
import { PhaseLabels } from '@/lib/retro/phases';
import { MaxSurveys, SurveyPhases } from '@/lib/retro/survey-api';
import type { Snapshot } from '@/lib/retro/types';
import { useBoard } from './board-context';
import {
    SurveyEditorDialog,
    useSurveyEditor,
} from './surveys/survey-editor-dialog';

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
        max_votes_per_card: retro.maxVotesPerCardSetting,
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

type PhaseMinutesKey = `phase_minutes_${TimedPhase}`;

/**
 * The "Timer per phase" row as the popover's flat values: the select and one
 * stepper per phase. `phaseTimerPatch` turns them back into `phase_durations`.
 */
export type PhaseTimerSettingsValues = {
    phase_timer: PhaseTimerChoice;
} & Record<PhaseMinutesKey, number>;

type BoardSettingsValues = RetroSettingsValues &
    Partial<PhaseTimerSettingsValues>;

const minutesKey = (phase: TimedPhase): PhaseMinutesKey =>
    `phase_minutes_${phase}`;

export function phaseTimerSettingsValues(
    durations: PhaseDurations | null,
): PhaseTimerSettingsValues {
    const steppers = customStart(durations);

    return {
        phase_timer: choiceOf(durations),
        phase_minutes_writing: steppers.writing,
        phase_minutes_grouping: steppers.grouping,
        phase_minutes_voting: steppers.voting,
        phase_minutes_discussing: steppers.discussing,
        phase_minutes_actions: steppers.actions,
    };
}

/** The patch the settings endpoint takes: the flat timer values become `phase_durations`. */
export function phaseTimerPatch(
    patch: Partial<BoardSettingsValues>,
    current: PhaseTimerSettingsValues,
): Partial<RetroSettingsValues> & { phase_durations?: PhaseDurations | null } {
    const timerKeys = [
        'phase_timer',
        ...TimedPhases.map(minutesKey),
    ] as (keyof PhaseTimerSettingsValues)[];
    const touchesTimer = timerKeys.some((key) => patch[key] !== undefined);
    const rest = Object.fromEntries(
        Object.entries(patch).filter(
            ([key]) =>
                !timerKeys.includes(key as keyof PhaseTimerSettingsValues),
        ),
    ) as Partial<RetroSettingsValues>;

    if (!touchesTimer) {
        return rest;
    }

    const custom = Object.fromEntries(
        TimedPhases.map((phase) => [
            phase,
            patch[minutesKey(phase)] ?? current[minutesKey(phase)],
        ]),
    ) as Required<PhaseDurations>;

    return {
        ...rest,
        phase_durations: durationsFor(
            patch.phase_timer ?? current.phase_timer,
            custom,
        ),
    };
}

function usePhaseTimerGroup(
    durations: PhaseDurations | null,
): SessionSettingGroup['settings'] {
    const { t } = useTrans();
    const phaseLabel = (phase: TimedPhase) => t(PhaseLabels[phase]);

    return [
        {
            type: 'select',
            key: 'phase_timer',
            id: 'retro-phase-timers',
            label: t('Timer per phase'),
            help: summary(durations, phaseLabel) ?? t('Off'),
            options: [
                { value: 'none', label: t('No timer') },
                { value: 'standard', label: t('Standard') },
                { value: 'custom', label: t('Custom (5 phases)') },
            ],
        },
        ...TimedPhases.map((phase): StepperSetting => ({
            type: 'stepper',
            key: minutesKey(phase),
            id: `retro-phase-${phase}`,
            label: phaseLabel(phase),
            help: t('Minutes, 0 for off'),
            min: 0,
            max: MaxPhaseMinutes,
            visibleWhen: { key: 'phase_timer', equals: 'custom' },
        })),
    ];
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
    const [draft, setDraft] = useState<Partial<BoardSettingsValues>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const surveyEditor = useSurveyEditor();
    const canAddSurvey =
        board.viewer.isFacilitator &&
        SurveyPhases.includes(retro.phase) &&
        ctx.isEditable &&
        board.surveys.length < MaxSurveys;
    const canAttachHealthCheck =
        board.viewer.isFacilitator && retro.phase !== 'completed';

    const canEditPhaseTimers =
        board.viewer.isFacilitator && retro.phase !== 'completed';
    const phaseTimerSettings = usePhaseTimerGroup(retro.phaseDurations);
    const phaseTimerValues = phaseTimerSettingsValues(retro.phaseDurations);

    const retroGroups = useRetroSettingGroups({
        phase: retro.phase,
        isAnonymous: retro.isAnonymous,
        icebreakerGame: retro.icebreakerGame,
        votesPerParticipant: retro.votesPerParticipant,
        hasCards: board.cards.length > 0,
        icebreakerGames: board.icebreakerGames,
        gifProvider: retro.gifProvider,
        llmProvider: board.features.llm ? board.features.llmProvider : null,
    });

    const groups = canEditPhaseTimers
        ? retroGroups.map((group) =>
              group.id === 'phases'
                  ? {
                        ...group,
                        settings: [...group.settings, ...phaseTimerSettings],
                    }
                  : group,
          )
        : retroGroups;

    const facilitator = board.participants.find(
        (participant) => participant.id === retro.facilitatorParticipantId,
    );

    const apply = async (patch: Partial<BoardSettingsValues>) => {
        setErrors({});

        try {
            await retroRequest(
                RetroSettingsController.update(retro.id),
                phaseTimerPatch(patch, phaseTimerValues),
            );
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
                    fields.map(([key, messages]) => [
                        key.startsWith('phase_durations') ? 'phase_timer' : key,
                        messages[0],
                    ]),
                ),
            );

            throw caught;
        }

        await ctx.refetch();
    };

    // The survey dialog takes the place of the panel: a draft of the
    // settings is kept for when the panel opens again. The dialog gives the
    // keyboard back to what had it at its opening, and "Add survey" is gone
    // with the panel: the settings button takes it first.
    const addSurvey = () => {
        onOpenChange(false);
        anchorRef?.current?.focus();
        surveyEditor.openCreate();
    };

    const attachHealthCheck = async () => {
        const response = await ctx.run(
            retroRequest(RetroHealthChecksController.store(retro.id)).then(
                () => true,
            ),
        );

        if (response) {
            await ctx.refetch();
        }
    };

    const onAddSurvey = (kind: SurveyKind) => {
        if (kind === 'quick_poll') {
            addSurvey();

            return;
        }

        void attachHealthCheck();
    };

    return (
        <>
            <SessionSettingsPopover<BoardSettingsValues>
                open={open && !ctx.sessionExpired}
                onOpenChange={onOpenChange}
                title={t('Retrospective settings')}
                sessionTitle={retro.title}
                phase={retro.phase}
                groups={groups}
                value={
                    canEditPhaseTimers
                        ? { ...retroSettingsValues(retro), ...phaseTimerValues }
                        : retroSettingsValues(retro)
                }
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
                onAddSurvey={canAttachHealthCheck ? onAddSurvey : undefined}
                surveys={{
                    healthCheckStatements: retro.healthCheckStatements,
                    healthCheckAttached: board.healthCheck !== null,
                    quickPollAvailable: canAddSurvey,
                }}
            />
            <SurveyEditorDialog editor={surveyEditor} />
        </>
    );
}
