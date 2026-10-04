import { CircleAlert, SquarePen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    isValidTeamSlug,
    slugFromName,
    TeamSlugMaxLength,
} from '@/lib/teams/team-slug';
import { cn } from '@/lib/utils';

/**
 * "Team link" (decision 7 B): the instance's address and `/t/` in `base`,
 * then the slug. Until it is edited the slug follows the team's name, the
 * server deriving the one it keeps; "Edit" calls `onChange` with the slug
 * shown, which makes it edited from then on.
 */
export function TeamAddressField({
    id,
    base,
    slug,
    name,
    isEdited,
    onChange,
    error,
    disabled,
}: {
    id: string;
    base: string;
    slug: string;
    name: string;
    isEdited: boolean;
    onChange: (slug: string) => void;
    error?: string;
    disabled?: boolean;
}) {
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const shown = isEdited ? slug : slugFromName(name);
    const message =
        error ??
        (isEdited && !isValidTeamSlug(slug)
            ? t('Use lower-case letters, digits and hyphens.')
            : undefined);
    const labelId = `${id}-label`;
    const errorId = `${id}-error`;
    const describedBy = message === undefined ? undefined : errorId;

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);

    const edit = (): void => {
        setEditing(true);

        if (!isEdited) {
            onChange(shown);
        }
    };

    return (
        <div
            data-slot="team-address-field"
            className="flex min-w-0 flex-col gap-1.5"
        >
            {editing ? (
                <label
                    id={labelId}
                    htmlFor={id}
                    className="text-sm leading-none font-medium select-none"
                >
                    {t('Team link')}
                </label>
            ) : (
                <span
                    id={labelId}
                    className="text-sm leading-none font-medium select-none"
                >
                    {t('Team link')}
                </span>
            )}
            <div
                role={editing ? undefined : 'group'}
                aria-labelledby={editing ? undefined : labelId}
                aria-describedby={editing ? undefined : describedBy}
                className={cn(
                    'flex min-h-9 min-w-0 items-center rounded-md border border-input bg-muted py-1 pr-1 pl-3',
                    editing &&
                        'bg-card shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
                    message !== undefined &&
                        'border-destructive focus-within:border-destructive focus-within:ring-destructive',
                )}
            >
                <span className="max-w-1/2 shrink-0 truncate font-mono text-sm text-muted-foreground">
                    {base}
                </span>
                {editing ? (
                    <input
                        ref={inputRef}
                        id={id}
                        type="text"
                        value={slug}
                        maxLength={TeamSlugMaxLength}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={disabled}
                        aria-invalid={message === undefined ? undefined : true}
                        aria-describedby={describedBy}
                        onChange={(event) => onChange(event.target.value)}
                        className="h-7 min-w-0 flex-1 bg-transparent font-mono text-sm font-semibold outline-none"
                    />
                ) : (
                    <>
                        <span
                            data-slot="team-address-slug"
                            className="min-w-0 flex-1 truncate font-mono text-sm font-semibold"
                        >
                            {shown}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            aria-describedby={describedBy}
                            onClick={edit}
                            className="ml-2 shrink-0"
                        >
                            <SquarePen aria-hidden="true" />
                            {t('Edit')}
                        </Button>
                    </>
                )}
            </div>
            {message !== undefined && (
                <span
                    id={errorId}
                    data-slot="field-error"
                    className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
                >
                    <CircleAlert
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    {message}
                </span>
            )}
        </div>
    );
}
