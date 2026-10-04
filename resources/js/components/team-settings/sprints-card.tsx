import { router, usePage } from '@inertiajs/react';
import { CalendarRange, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { toast } from 'sonner';
import TeamRitualsController from '@/actions/App/Http/Controllers/TeamRitualsController';
import TeamSprintsController from '@/actions/App/Http/Controllers/TeamSprintsController';
import TeamSprintStartsController from '@/actions/App/Http/Controllers/TeamSprintStartsController';
import InputError from '@/components/input-error';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { SettingsPanel } from '@/components/team-settings/settings-panel';
import { SprintForm } from '@/components/team-settings/sprint-form';
import type { SprintFormErrors } from '@/components/team-settings/sprint-form';
import {
    localDay,
    newSprintDefaults,
    previewNextRetro,
} from '@/components/team-settings/sprint-planning';
import type { SprintDraft } from '@/components/team-settings/sprint-planning';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import {
    formatShortDay,
    nextRetroLabel,
    sprintRange,
    sprintTitle,
} from '@/lib/teams/sprint';
import type {
    TeamRituals,
    TeamSprintRow,
    TeamSprintsPanel,
    TeamSummary,
} from '@/types';

/** 40rem: below it the list becomes cards. */
const TableMinWidth = 640;

const ShownSprints = 10;

/** `Team::DefaultSprintLengthWeeks`. */
const DefaultLengthWeeks = 2;

const NoWeekday = 'none';

type SprintsCardProps = {
    workspaceSlug: string;
    team: TeamSummary;
    sprints: TeamSprintsPanel;
    rituals: TeamRituals;
};

type OpenForm = { mode: 'add' } | { mode: 'edit'; sprint: TeamSprintRow };

type RitualsErrors = Partial<
    Record<'sprint_length_weeks' | 'retro_weekday' | 'retro_time', string>
>;

function weekdayName(isoWeekday: number, locale: string): string {
    const name = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 0, isoWeekday)));

    return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}`;
}

/**
 * The Sprints card of Members & rituals (decision 1 B, no mockup: designed
 * from the settings cards of ScreenSettings frame a): the current sprint,
 * "Start the next sprint", the list of sprints, and the rituals that give
 * the next retro.
 */
export function SprintsCard({
    workspaceSlug,
    team,
    sprints,
    rituals,
}: SprintsCardProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const wide = useMinWidth(TableMinWidth);
    const startHelpId = useId();
    const scope = { workspace: workspaceSlug, team: team.id };
    const [starting, setStarting] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [form, setForm] = useState<OpenForm | null>(null);
    const [deleting, setDeleting] = useState<TeamSprintRow | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [deleteError, setDeleteError] = useState<string>();

    const visible = showAll
        ? sprints.list
        : sprints.list.slice(0, ShownSprints);
    const hidden = sprints.list.length - visible.length;

    const start = (): void => {
        router.post(
            TeamSprintStartsController.store.url(scope),
            {},
            {
                preserveScroll: true,
                onStart: () => setStarting(true),
                onError: (errors) =>
                    toast.error(
                        errors.sprint ??
                            Object.values(errors)[0] ??
                            t('Something went wrong. Please try again.'),
                    ),
                onFinish: () => setStarting(false),
            },
        );
    };

    const save = (draft: SprintDraft, sprint?: TeamSprintRow): Promise<void> =>
        new Promise((resolve, reject) => {
            const data = {
                number: draft.number,
                starts_on: draft.startsOn,
                ends_on: draft.endsOn,
            };
            const options = {
                preserveScroll: true,
                onSuccess: () => resolve(),
                onError: (errors: SprintFormErrors) => reject(errors),
            };

            if (sprint === undefined) {
                router.post(
                    TeamSprintsController.store.url(scope),
                    data,
                    options,
                );

                return;
            }

            router.patch(
                TeamSprintsController.update.url({
                    ...scope,
                    sprint: sprint.id,
                }),
                data,
                options,
            );
        });

    const destroy = (sprint: TeamSprintRow): Promise<void> =>
        new Promise((resolve, reject) => {
            setDeleteError(undefined);
            router.delete(
                TeamSprintsController.destroy.url({
                    ...scope,
                    sprint: sprint.id,
                }),
                {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: (errors) => {
                        const message =
                            Object.values(errors)[0] ??
                            t('Something went wrong. Please try again.');

                        setDeleteError(message);
                        reject(new Error(message));
                    },
                },
            );
        });

    const rowMenu = (sprint: TeamSprintRow) => (
        <CardMenu
            label={t('Sprint actions')}
            trigger={
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Sprint actions')}
                >
                    <Ellipsis aria-hidden />
                </Button>
            }
            entries={[
                {
                    type: 'item',
                    label: t('Edit'),
                    icon: Pencil,
                    onSelect: () => setForm({ mode: 'edit', sprint }),
                },
                {
                    type: 'item',
                    label: t('Delete'),
                    icon: Trash2,
                    tone: 'danger',
                    onSelect: () => {
                        setDeleteError(undefined);
                        setDeleting(sprint);
                        setConfirming(true);
                    },
                },
            ]}
        />
    );

    const currentBadge = (sprint: TeamSprintRow) =>
        sprint.isCurrent ? (
            <Badge variant="soft" shape="pill">
                {t('Current')}
            </Badge>
        ) : null;

    const list = wide ? (
        <Table data-test="team-sprints">
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5">{t('Sprint')}</TableHead>
                    <TableHead className="px-5">{t('Days')}</TableHead>
                    <TableHead className="px-5">
                        <span className="sr-only">{t('Actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {visible.map((sprint) => (
                    <TableRow
                        key={sprint.id}
                        data-sprint-id={sprint.id}
                        data-current={sprint.isCurrent || undefined}
                    >
                        <TableCell className="w-full max-w-0 px-5 py-1.5">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold">
                                    {sprintTitle(sprint, t)}
                                </span>
                                {currentBadge(sprint)}
                            </span>
                        </TableCell>
                        <TableCell className="px-5 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
                            {sprintRange(sprint, locale)}
                        </TableCell>
                        <TableCell className="px-5 py-1.5 text-right">
                            {rowMenu(sprint)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    ) : (
        <ul data-test="team-sprints" className="flex flex-col divide-y">
            {visible.map((sprint) => (
                <li
                    key={sprint.id}
                    data-sprint-id={sprint.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3"
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                            {sprintTitle(sprint, t)}
                        </span>
                        {currentBadge(sprint)}
                    </span>
                    {rowMenu(sprint)}
                    <span className="text-sm text-muted-foreground">
                        {sprintRange(sprint, locale)}
                    </span>
                </li>
            ))}
        </ul>
    );

    const formDraft = (open: OpenForm): SprintDraft => {
        if (open.mode === 'edit') {
            return {
                number: open.sprint.number,
                startsOn: open.sprint.startsOn,
                endsOn: open.sprint.endsOn,
            };
        }

        return newSprintDefaults(
            sprints.list,
            sprints.nextStart.number,
            rituals.sprintLengthWeeks ?? DefaultLengthWeeks,
            localDay(new Date()),
        );
    };

    return (
        <SettingsPanel
            id="sprints"
            title={
                <span className="inline-flex items-center gap-2">
                    <CalendarRange
                        aria-hidden
                        className="size-4 text-muted-foreground"
                    />
                    {t('Sprints')}
                </span>
            }
            actions={
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ mode: 'add' })}
                >
                    <Plus aria-hidden />
                    {t('Add a sprint')}
                </Button>
            }
            flush
            footer={
                <RitualsForm
                    workspaceSlug={workspaceSlug}
                    team={team}
                    sprints={sprints}
                    rituals={rituals}
                />
            }
        >
            <div className="flex min-w-0 flex-col gap-4 p-5">
                {sprints.current === null ? (
                    <p
                        data-test="current-sprint"
                        className="text-sm text-muted-foreground"
                    >
                        {t('No sprint in progress.')}
                    </p>
                ) : (
                    <div
                        data-test="current-sprint"
                        className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-skrum-primary-soft bg-skrum-primary-soft/50 px-3 py-2"
                    >
                        <span className="min-w-0 text-sm font-semibold wrap-anywhere">
                            {`${sprintTitle(sprints.current, t)} · ${sprintRange(sprints.current, locale)}`}
                        </span>
                        <Badge variant="soft" shape="pill">
                            {t('Current')}
                        </Badge>
                    </div>
                )}
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <LoadingButton
                        type="button"
                        loading={starting}
                        disabled={sprints.nextStart.refusal !== null}
                        aria-describedby={startHelpId}
                        onClick={start}
                        className="max-w-full"
                    >
                        <span className="truncate">
                            {t('Start the next sprint')}
                        </span>
                    </LoadingButton>
                    <p
                        id={startHelpId}
                        className="text-body-sm text-muted-foreground"
                    >
                        {sprints.nextStart.refusal ??
                            t('Sprint :number · from today to :date', {
                                number: sprints.nextStart.number,
                                date: formatShortDay(
                                    sprints.nextStart.endsOn,
                                    locale,
                                ),
                            })}
                    </p>
                </div>
            </div>

            {sprints.list.length > 0 && (
                <div className="flex min-w-0 flex-col border-t">
                    {list}
                    {(hidden > 0 || sprints.total > sprints.list.length) && (
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-2">
                            {sprints.total > sprints.list.length && (
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'The :count latest sprints are listed.',
                                        {
                                            count: sprints.list.length,
                                        },
                                    )}
                                </p>
                            )}
                            {hidden > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowAll(true)}
                                >
                                    {t('Show all (:count)', {
                                        count: sprints.list.length,
                                    })}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {form !== null && (
                <SprintForm
                    key={form.mode === 'edit' ? form.sprint.id : 'add'}
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setForm(null);
                        }
                    }}
                    title={
                        form.mode === 'edit'
                            ? sprintTitle(form.sprint, t)
                            : t('Add a sprint')
                    }
                    submitLabel={form.mode === 'edit' ? t('Save') : t('Add')}
                    initial={formDraft(form)}
                    editing={form.mode === 'edit'}
                    onSubmit={(draft) =>
                        save(
                            draft,
                            form.mode === 'edit' ? form.sprint : undefined,
                        )
                    }
                />
            )}

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                tone="destructive"
                title={t('Delete Sprint :number?', {
                    number: deleting?.number ?? '',
                })}
                description={t(
                    "Sessions keep their content; they lose this sprint's label.",
                )}
                confirmLabel={t('Delete')}
                onConfirm={() =>
                    deleting === null ? Promise.resolve() : destroy(deleting)
                }
                error={deleteError}
            />
        </SettingsPanel>
    );
}

/** The footer of the card: default length, retro day and time, the next retro they give, "Save". */
function RitualsForm({
    workspaceSlug,
    team,
    sprints,
    rituals,
}: SprintsCardProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const lengthLabelId = useId();
    const [length, setLength] = useState(
        rituals.sprintLengthWeeks ?? DefaultLengthWeeks,
    );
    const [weekday, setWeekday] = useState<number | null>(rituals.retroWeekday);
    const [time, setTime] = useState(rituals.retroTime ?? '');
    const [errors, setErrors] = useState<RitualsErrors>({});
    const [saving, setSaving] = useState(false);

    const errorProps = (key: keyof RitualsErrors, id: string) =>
        errors[key] === undefined
            ? {}
            : { 'aria-invalid': true, 'aria-describedby': `${id}-error` };

    const unchanged =
        weekday === rituals.retroWeekday && time === (rituals.retroTime ?? '');
    const nextRetro = unchanged
        ? sprints.nextRetro
        : previewNextRetro(
              sprints.list,
              weekday,
              time === '' ? null : time,
              new Date(),
          );

    const preview = (): string | null => {
        if (weekday === null) {
            return null;
        }

        if (nextRetro === null) {
            return t('No next retro until the next sprint is started.');
        }

        return nextRetroLabel(nextRetro, locale, t);
    };

    const previewLine = preview();

    const submit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        if (saving) {
            return;
        }

        router.put(
            TeamRitualsController.update.url({
                workspace: workspaceSlug,
                team: team.id,
            }),
            {
                sprint_length_weeks: length,
                retro_weekday: weekday,
                retro_time: weekday === null || time === '' ? null : time,
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onSuccess: () => setErrors({}),
                onError: (failures) =>
                    setErrors({
                        sprint_length_weeks: failures.sprint_length_weeks,
                        retro_weekday: failures.retro_weekday,
                        retro_time: failures.retro_time,
                    }),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <form
            onSubmit={submit}
            noValidate
            className="flex w-full min-w-0 flex-col gap-4 py-1"
        >
            <div className="flex min-w-0 flex-wrap items-start gap-x-5 gap-y-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span id={lengthLabelId} className="text-sm font-medium">
                        {t('Default length')}
                    </span>
                    <div
                        id="sprint-length"
                        aria-labelledby={lengthLabelId}
                        className="max-w-full"
                    >
                        <ToggleGroup
                            type="single"
                            variant="segmented"
                            className="[&>*]:shrink!"
                            aria-label={t('Default length')}
                            value={String(length)}
                            onValueChange={(value) => {
                                if (value !== '') {
                                    setLength(Number(value));
                                }
                            }}
                            options={[1, 2, 3, 4].map((weeks) => ({
                                value: String(weeks),
                                label:
                                    weeks === 1
                                        ? t('1 week')
                                        : t(':count weeks', { count: weeks }),
                            }))}
                        />
                    </div>
                    <InputError
                        id="sprint-length-error"
                        message={errors.sprint_length_weeks}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="retro-weekday">{t('Retro day')}</Label>
                    <Select
                        name="retro_weekday"
                        value={weekday === null ? NoWeekday : String(weekday)}
                        onValueChange={(value) => {
                            if (value === NoWeekday) {
                                setWeekday(null);
                                setTime('');

                                return;
                            }

                            setWeekday(Number(value));
                        }}
                    >
                        <SelectTrigger
                            id="retro-weekday"
                            className="w-40 max-w-full"
                            {...errorProps('retro_weekday', 'retro-weekday')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NoWeekday}>
                                {t('None')}
                            </SelectItem>
                            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                                <SelectItem key={day} value={String(day)}>
                                    {weekdayName(day, locale)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError
                        id="retro-weekday-error"
                        message={errors.retro_weekday}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label
                        htmlFor="retro-time"
                        className={weekday === null ? 'opacity-55' : undefined}
                    >
                        {t('Time')}
                    </Label>
                    <Input
                        id="retro-time"
                        name="retro_time"
                        type="time"
                        value={time}
                        disabled={weekday === null}
                        onChange={(event) => setTime(event.target.value)}
                        className="w-32 max-w-full"
                        {...errorProps('retro_time', 'retro-time')}
                    />
                    <InputError
                        id="retro-time-error"
                        message={errors.retro_time}
                    />
                </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <p
                    data-test="next-retro-preview"
                    aria-live="polite"
                    className="min-w-0 text-body-sm text-muted-foreground"
                >
                    {previewLine}
                </p>
                <LoadingButton
                    type="submit"
                    size="sm"
                    loading={saving}
                    className="max-w-full"
                >
                    <span className="truncate">{t('Save')}</span>
                </LoadingButton>
            </div>
        </form>
    );
}
