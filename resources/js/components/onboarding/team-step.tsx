import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useId, useRef } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import OnboardingCompletionsController from '@/actions/App/Http/Controllers/OnboardingCompletionsController';
import OnboardingStepsController from '@/actions/App/Http/Controllers/OnboardingStepsController';
import OnboardingTeamsController from '@/actions/App/Http/Controllers/OnboardingTeamsController';
import {
    StepActions,
    StepFieldError,
    StepHeading,
} from '@/components/onboarding/step-layout';
import { useStepRequest } from '@/components/onboarding/use-step-request';
import { useColumnColorName } from '@/components/skrum/column-color-picker';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TeamAddressField } from '@/components/skrum/team-address-field';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import { slugFromName } from '@/lib/teams/team-slug';
import { cn } from '@/lib/utils';

export const MaxTeamNameLength = 100;

export const MaxTeamDescriptionLength = 200;

/** The eight column colours, in the order ScreenOnboarding draws them. */
export const TeamColors: ColumnColor[] = [
    'moss',
    'coral',
    'sun',
    'plum',
    'sky',
    'lagoon',
    'iris',
    'apricot',
];

export type TeamDraft = {
    name: string;
    color: ColumnColor;
    /** The slug typed after "Edit"; meaningful only once `slugEdited`. */
    slug: string;
    slugEdited: boolean;
    description: string;
};

/** The slug the team link shows: the edited one, else the name's. */
export function draftSlug(draft: TeamDraft): string {
    return draft.slugEdited ? draft.slug : slugFromName(draft.name);
}

/** "Team colour" (`.ob-sw`): eight swatches in a radiogroup, the chosen colour named under them. */
function TeamColorField({
    value,
    onChange,
    error,
    disabled,
}: {
    value: ColumnColor;
    onChange: (color: ColumnColor) => void;
    error?: string;
    disabled?: boolean;
}) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const labelId = useId();
    const errorId = useId();
    const swatches = useRef(new Map<ColumnColor, HTMLButtonElement>());
    const tabStop = TeamColors.includes(value) ? value : TeamColors[0];

    const move = (
        event: KeyboardEvent<HTMLButtonElement>,
        from: ColumnColor,
    ) => {
        const steps: Record<string, number> = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1,
        };
        const step = steps[event.key];

        if (step === undefined) {
            return;
        }

        event.preventDefault();
        const index = TeamColors.indexOf(from);
        const next =
            TeamColors[(index + step + TeamColors.length) % TeamColors.length];

        onChange(next);
        swatches.current.get(next)?.focus();
    };

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span id={labelId} className="text-sm leading-none font-medium">
                {t('Team colour')}
            </span>
            <div
                role="radiogroup"
                aria-labelledby={labelId}
                aria-describedby={error === undefined ? undefined : errorId}
                aria-invalid={error === undefined ? undefined : true}
                className="flex flex-wrap gap-2"
            >
                {TeamColors.map((color) => {
                    const checked = color === value;

                    return (
                        <button
                            key={color}
                            ref={(node) => {
                                if (node === null) {
                                    swatches.current.delete(color);

                                    return;
                                }

                                swatches.current.set(color, node);
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-label={colorName(color)}
                            data-color={color}
                            tabIndex={color === tabStop ? 0 : -1}
                            disabled={disabled}
                            onClick={() => onChange(color)}
                            onKeyDown={(event) => move(event, color)}
                            className={cn(
                                'grid size-9 place-items-center rounded-md border-[0.09375rem] border-(--col-border) bg-(--col) text-(--col-text) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
                                `col-${color}`,
                                checked &&
                                    'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                            )}
                        >
                            {checked && (
                                <Check
                                    className="size-4 stroke-3"
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            {error === undefined ? (
                <span className="text-body-sm text-muted-foreground">
                    {colorName(value)}
                </span>
            ) : (
                <StepFieldError id={errorId} message={error} />
            )}
        </div>
    );
}

/**
 * Step 2, "Create your first team": name, colour, team link and
 * description, with "Back", "Skip for now" and "Continue" as drawn. The
 * slug is sent only once edited: an unedited one is derived by the server.
 */
export function TeamStep({
    draft,
    onDraftChange,
    addressBase,
    workspaceName,
    canGoBack,
}: {
    draft: TeamDraft;
    onDraftChange: (draft: TeamDraft) => void;
    addressBase: string;
    workspaceName: string;
    canGoBack: boolean;
}) {
    const { t } = useTrans();
    const fieldId = useId();
    const { pending, busy, errors, send } = useStepRequest<
        'continue' | 'back' | 'skip'
    >();

    const change = (fields: Partial<TeamDraft>): void =>
        onDraftChange({ ...draft, ...fields });

    const submit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        send('continue', 'put', OnboardingTeamsController.update.url(), {
            name: draft.name,
            color: draft.color,
            description: draft.description,
            ...(draft.slugEdited ? { slug: draft.slug } : {}),
        });
    };

    return (
        <form
            data-slot="team-step"
            noValidate
            onSubmit={submit}
            className="flex min-w-0 flex-col gap-5"
        >
            <StepHeading
                number={2}
                title={t('Create your first team')}
                lead={t(
                    'A team is the people who run their rituals together. You can add more teams to :workspace later.',
                    { workspace: workspaceName },
                )}
            />
            <TextField
                id={`${fieldId}-name`}
                label={t('Team name')}
                description={t(
                    'Shown in the sidebar, on invitations and in session links.',
                )}
                value={draft.name}
                maxLength={MaxTeamNameLength}
                autoFocus
                required
                disabled={busy}
                error={errors.name}
                onChange={(event) => change({ name: event.target.value })}
            />
            <TeamColorField
                value={draft.color}
                onChange={(color) => change({ color })}
                error={errors.color}
                disabled={busy}
            />
            <TeamAddressField
                id={`${fieldId}-slug`}
                base={addressBase}
                slug={draft.slug}
                name={draft.name}
                isEdited={draft.slugEdited}
                onChange={(slug) => change({ slug, slugEdited: true })}
                error={errors.slug}
                disabled={busy}
            />
            <TextField
                id={`${fieldId}-description`}
                label={t('Description · optional')}
                placeholder={t('Mobile app squad — sprints of 2 weeks')}
                value={draft.description}
                maxLength={MaxTeamDescriptionLength}
                disabled={busy}
                error={errors.description}
                onChange={(event) =>
                    change({ description: event.target.value })
                }
            />
            <StepActions>
                {canGoBack && (
                    <LoadingButton
                        type="button"
                        variant="ghost"
                        loading={pending === 'back'}
                        disabled={busy}
                        onClick={() =>
                            send(
                                'back',
                                'put',
                                OnboardingStepsController.update.url(),
                                { step: 'workspace' },
                            )
                        }
                    >
                        {pending !== 'back' && <ArrowLeft aria-hidden="true" />}
                        {t('Back')}
                    </LoadingButton>
                )}
                <span className="grow" />
                <LoadingButton
                    type="button"
                    variant="ghost"
                    loading={pending === 'skip'}
                    disabled={busy}
                    onClick={() =>
                        send(
                            'skip',
                            'post',
                            OnboardingCompletionsController.store.url(),
                        )
                    }
                >
                    {t('Skip for now')}
                </LoadingButton>
                <LoadingButton
                    type="submit"
                    size="lg"
                    loading={pending === 'continue'}
                    disabled={busy}
                >
                    {t('Continue')}
                    {pending !== 'continue' && (
                        <ArrowRight aria-hidden="true" />
                    )}
                </LoadingButton>
            </StepActions>
            <StepFieldError message={errors.ritual ?? errors.step} />
            <span className="text-xs text-muted-foreground">
                {t('Everything can be changed later in Team settings.')}
            </span>
        </form>
    );
}
