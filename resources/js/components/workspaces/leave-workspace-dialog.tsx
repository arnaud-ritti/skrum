import { router, usePage } from '@inertiajs/react';
import { CircleAlert, DoorOpen, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, Ref } from 'react';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceSummary } from '@/types';

const ListedTeams = 3;
const NameSlot = '\u0000';

/** What the person leaving is told; every field is optional on a page that does not hold it. */
type LeaveWorkspaceContext = {
    /** Names of the teams of the workspace the person belongs to. */
    teams?: string[];
    /** Given to a person who manages the workspace: owners and admins, themselves included. */
    adminsCount?: number;
    otherAdminName?: string | null;
};

type LeaveWorkspaceDialogProps = LeaveWorkspaceContext & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspace: WorkspaceSummary;
};

export function matchesWorkspaceName(typed: string, name: string): boolean {
    return typed.trim() === name.trim();
}

function useLeaveWorkspace(workspace: WorkspaceSummary) {
    const { auth } = usePage().props;
    const { run, error, reset } = useRouterAction();
    const [typed, setTyped] = useState('');

    return {
        typed,
        setTyped,
        matches: matchesWorkspaceName(typed, workspace.name),
        error,
        clear: () => {
            setTyped('');
            reset();
        },
        leave: () =>
            run((options) =>
                router.delete(
                    WorkspaceMembersController.destroy.url({
                        workspace: workspace.slug,
                        member: auth.user.id,
                    }),
                    options,
                ),
            ),
    };
}

function useConsequences({
    teams = [],
    adminsCount,
    otherAdminName,
}: LeaveWorkspaceContext): string[] {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const lines: string[] = [];

    if (teams.length > ListedTeams) {
        lines.push(t('You leave :count teams.', { count: teams.length }));
    }

    if (teams.length > 0 && teams.length <= ListedTeams) {
        lines.push(
            t('You leave :teams.', {
                teams: new Intl.ListFormat(locale ?? 'en', {
                    style: 'long',
                    type: 'conjunction',
                }).format(teams),
            }),
        );
    }

    if (adminsCount === 1) {
        lines.push(t("You're the only admin of this workspace."));
    }

    if (adminsCount !== undefined && adminsCount > 1) {
        lines.push(
            otherAdminName
                ? t("You're one of :count admins — :name stays admin.", {
                      count: adminsCount,
                      name: otherAdminName,
                  })
                : t("You're one of :count admins.", { count: adminsCount }),
        );
    }

    lines.push(t('An admin can invite you again later.'));

    return lines;
}

/** "Type :name to confirm", for the two actions that end a workspace for someone. */
export function ConfirmNameField({
    id,
    name,
    value,
    onChange,
    disabled,
    inputRef,
}: {
    id: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    inputRef?: Ref<HTMLInputElement>;
}) {
    const { t } = useTrans();
    const [before, after] = t('Type :name to confirm', {
        name: NameSlot,
    }).split(NameSlot);

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={id}>
                {before}
                <span className="font-mono">{name}</span>
                {after}
            </Label>
            <Input
                ref={inputRef}
                id={id}
                name="confirmation"
                value={value}
                disabled={disabled}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(event) => onChange(event.target.value)}
                className="max-w-80"
            />
        </div>
    );
}

function Consequences({ id, lines }: { id?: string; lines: string[] }) {
    return (
        <ul
            id={id}
            data-slot="leave-consequences"
            className="list-disc pl-4.5 text-body-sm text-muted-foreground"
        >
            {lines.map((line) => (
                <li key={line}>{line}</li>
            ))}
        </ul>
    );
}

/** The confirmation as a modal dialog: on a phone, and wherever no panel can unfold. */
export function LeaveWorkspaceDialog({
    open,
    onOpenChange,
    workspace,
    ...context
}: LeaveWorkspaceDialogProps) {
    const { t } = useTrans();
    const fieldId = useId();
    const lines = useConsequences(context);
    const { typed, setTyped, matches, error, clear, leave } =
        useLeaveWorkspace(workspace);

    return (
        <FormDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    clear();
                }

                onOpenChange(next);
            }}
            title={t('Leave :name?', { name: workspace.name })}
            tone="destructive"
            submitLabel={t('Leave :name', { name: workspace.name })}
            submitIcon={DoorOpen}
            submitDisabled={!matches}
            submitTest="leave-workspace-confirm"
            onSubmit={leave}
            error={error}
        >
            <Consequences lines={lines} />
            <ConfirmNameField
                id={fieldId}
                name={workspace.name}
                value={typed}
                onChange={setTyped}
            />
        </FormDialog>
    );
}

/**
 * The confirmation unfolded under the "Leave workspace" row, as the mockup
 * draws it on a desktop. Not modal: the page stays usable around it.
 */
export function LeaveWorkspacePanel({
    open,
    onOpenChange,
    workspace,
    autoFocus = true,
    id,
    ...context
}: LeaveWorkspaceDialogProps & {
    /** Off on the bench, where the panel is drawn open among other examples. */
    autoFocus?: boolean;
    /** Named by the `aria-controls` of the button that unfolds it. */
    id?: string;
}) {
    const { t } = useTrans();
    const titleId = useId();
    const listId = useId();
    const fieldId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState(false);
    const lines = useConsequences(context);
    const { typed, setTyped, matches, error, clear, leave } =
        useLeaveWorkspace(workspace);

    useEffect(() => {
        if (open && autoFocus) {
            inputRef.current?.focus();
        }
    }, [open, autoFocus]);

    if (!open) {
        return null;
    }

    const close = (): void => {
        if (pending) {
            return;
        }

        clear();
        onOpenChange(false);
    };

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (pending || !matches) {
            return;
        }

        setPending(true);

        try {
            await leave();
        } catch {
            inputRef.current?.focus();
        } finally {
            setPending(false);
        }
    };

    const closeOnEscape = (event: KeyboardEvent<HTMLFormElement>): void => {
        if (event.key !== 'Escape') {
            return;
        }

        event.stopPropagation();
        close();
    };

    return (
        <form
            id={id}
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={listId}
            aria-busy={pending}
            data-slot="leave-workspace-panel"
            onSubmit={submit}
            onKeyDown={closeOnEscape}
            className="grid max-w-2xl grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-xl border border-[color-mix(in_oklch,var(--destructive)_45%,var(--border))] bg-card p-5 shadow-card"
        >
            <span className="grid size-9 place-items-center rounded-full bg-skrum-destructive-soft text-skrum-destructive-text">
                <TriangleAlert aria-hidden className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <h3 id={titleId} className="font-semibold wrap-anywhere">
                        {t('Leave :name?', { name: workspace.name })}
                    </h3>
                    <Consequences id={listId} lines={lines} />
                </div>
                <ConfirmNameField
                    id={fieldId}
                    name={workspace.name}
                    value={typed}
                    onChange={setTyped}
                    disabled={pending}
                    inputRef={inputRef}
                />
                {error !== undefined && (
                    <p
                        role="alert"
                        className="flex items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                    >
                        <CircleAlert
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <span className="min-w-0">{error}</span>
                    </p>
                )}
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={pending || !matches}
                        data-test="leave-workspace-confirm"
                        className="max-w-full min-w-0"
                    >
                        {pending ? (
                            <Spinner aria-label={t('Loading')} />
                        ) : (
                            <DoorOpen aria-hidden />
                        )}
                        <span className="truncate">
                            {t('Leave :name', { name: workspace.name })}
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={close}
                    >
                        {t('Cancel')}
                    </Button>
                </div>
            </div>
        </form>
    );
}
