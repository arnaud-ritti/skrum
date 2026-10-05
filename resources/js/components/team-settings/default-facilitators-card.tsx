import { router, usePage } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import TeamFacilitatorsController from '@/actions/App/Http/Controllers/TeamFacilitatorsController';
import { SettingsPanel } from '@/components/team-settings/settings-panel';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CardMenu } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { formatShortDay } from '@/lib/teams/sprint';
import type {
    FacilitatorOption,
    NextRetro,
    TeamFacilitatorsPanel,
    TeamSummary,
} from '@/types';

/** `TeamFacilitatorsRequest::MaxFacilitators`. */
const MaxFacilitators = 10;

type DefaultFacilitatorsCardProps = {
    workspaceSlug: string;
    team: TeamSummary;
    facilitators: TeamFacilitatorsPanel;
    nextRetro: NextRetro | null;
};

type Choice = { list: FacilitatorOption[]; rotation: boolean };

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Default facilitators (ScreenSettings frame a): the people the "New
 * session" dialog suggests, in order, and whether the suggestion rotates.
 * Each change saves the whole list.
 */
export function DefaultFacilitatorsCard({
    workspaceSlug,
    team,
    facilitators,
    nextRetro,
}: DefaultFacilitatorsCardProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const switchId = useId();
    const helpId = useId();
    const errorId = useId();
    const [pending, setPending] = useState<Choice | null>(null);
    const latestSave = useRef(0);
    const [error, setError] = useState<string>();
    const shown: Choice = pending ?? {
        list: facilitators.list,
        rotation: facilitators.rotation,
    };
    const addable = facilitators.candidates.filter(
        (candidate) => !shown.list.some((person) => person.id === candidate.id),
    );

    /** A newer change cancels the older visit: only the last one clears what is shown. */
    const save = (choice: Choice): void => {
        const saveId = ++latestSave.current;

        setPending(choice);
        setError(undefined);

        router.put(
            TeamFacilitatorsController.update.url({
                workspace: workspaceSlug,
                team: team.id,
            }),
            {
                user_ids: choice.list.map((person) => person.id),
                rotation: choice.rotation,
            },
            {
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ??
                            t('Something went wrong. Please try again.'),
                    ),
                onFinish: () => {
                    if (saveId === latestSave.current) {
                        setPending(null);
                    }
                },
            },
        );
    };

    const remove = (person: FacilitatorOption): void => {
        const list = shown.list.filter((item) => item.id !== person.id);

        save({ list, rotation: shown.rotation && list.length > 0 });
    };

    const suggestion = (): string | null => {
        if (facilitators.suggested === null || shown.list.length === 0) {
            return null;
        }

        if (nextRetro === null) {
            return t('Suggested next: :name', {
                name: facilitators.suggested.name,
            });
        }

        return t('Suggested next: :name · retro of :date', {
            name: facilitators.suggested.name,
            date: formatShortDay(nextRetro.date, locale),
        });
    };

    const suggested = suggestion();

    return (
        <SettingsPanel id="facilitators" title={t('Default facilitators')}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                {shown.list.map((person) => (
                    <span
                        key={person.id}
                        className="inline-flex h-7.5 max-w-full min-w-0 items-center gap-1.5 rounded-full border bg-card pr-1 pl-1 text-sm font-medium"
                    >
                        <PersonAvatar
                            name={person.name}
                            src={person.avatarUrl}
                            size="xs"
                            decorative
                        />
                        <span data-slot="facilitator-chip" className="truncate">
                            {firstName(person.name)}
                        </span>
                        <button
                            type="button"
                            aria-label={t('Remove :name', {
                                name: person.name,
                            })}
                            onClick={() => remove(person)}
                            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <X aria-hidden className="size-3.5" />
                        </button>
                    </span>
                ))}
                <CardMenu
                    align="start"
                    label={t('Add')}
                    trigger={
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={
                                addable.length === 0 ||
                                shown.list.length >= MaxFacilitators
                            }
                        >
                            <Plus aria-hidden />
                            {t('Add')}
                        </Button>
                    }
                    entries={addable.map((person) => ({
                        type: 'item' as const,
                        label: person.name,
                        onSelect: () =>
                            save({
                                list: [...shown.list, person],
                                rotation: shown.rotation,
                            }),
                    }))}
                />
            </div>
            <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <label htmlFor={switchId} className="text-sm font-semibold">
                        {t('Rotate the suggestion at every retro')}
                    </label>
                    <p
                        id={helpId}
                        className="text-body-sm text-muted-foreground"
                    >
                        {shown.list.length === 0
                            ? t('Add a facilitator first.')
                            : suggested}
                    </p>
                </div>
                <Switch
                    id={switchId}
                    checked={shown.rotation}
                    disabled={shown.list.length === 0}
                    aria-describedby={
                        error === undefined ? helpId : `${helpId} ${errorId}`
                    }
                    onCheckedChange={(rotation) =>
                        save({ list: shown.list, rotation })
                    }
                    className="shrink-0"
                />
            </div>
            {error !== undefined && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {error}
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                {t(
                    'The person creating a retro can always choose someone else.',
                )}
            </p>
        </SettingsPanel>
    );
}
