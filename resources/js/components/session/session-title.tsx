import { Link } from '@inertiajs/react';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** The longest name the server takes for a retro, a poker game or a whiteboard. */
const NameMaxLength = 120;

type SessionTitleProps = {
    /** Absent or null for a guest: no back link. */
    backHref?: NavHref | null;
    /** Leaving has to be asked first: the arrow is a button that calls it, not a link. */
    onBack?: () => void;
    /** The line above the title, "team · session type". It gives way below the `session-detail` step of the header. */
    overline?: ReactNode;
    /** The line under the title on a phone, where the overline gives way: the phase. */
    subtitle?: ReactNode;
    /** Badges after the title (lock, deck, game). */
    badges?: ReactNode;
    /**
     * Renames the session in place, given only to who may: the name, when it
     * is plain text, and a pencil after it open a field. A rejected promise
     * keeps the field open and marked.
     */
    onRename?: (name: string) => Promise<void> | void;
    /** Accessible name of the pencil; "Rename" by default. */
    renameLabel?: string;
    /** Accessible name of the field; "Session name" by default. */
    nameLabel?: string;
    /** The server's limit for the name; 120 by default. */
    nameMaxLength?: number;
    children: ReactNode;
};

type RenamableNameProps = {
    name: string;
    onRename: (name: string) => Promise<void> | void;
    renameLabel: string;
    nameLabel: string;
    maxLength: number;
    className: string;
};

/**
 * The heading of a session its viewer may rename: a press on the name or on
 * the pencil, or F2, turns it into a field; Enter saves, and so does leaving
 * the field with a changed name; Escape cancels, and so does leaving it
 * empty. While it saves the field is read-only, not disabled, so it keeps
 * the focus if the save fails. The pencil leaves below `2xl`, with the
 * secondary controls of the bar; the name still opens the field.
 */
function RenamableName({
    name,
    onRename,
    renameLabel,
    nameLabel,
    maxLength,
    className,
}: RenamableNameProps) {
    const { t } = useTrans();
    const [draft, setDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [invalid, setInvalid] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const field = useRef<HTMLInputElement>(null);
    const restoreFocus = useRef(false);
    const isClosing = useRef(false);
    const isEditing = draft !== null;

    useEffect(() => {
        if (isEditing || !restoreFocus.current) {
            return;
        }

        restoreFocus.current = false;
        trigger.current?.focus();
    }, [isEditing]);

    const open = (): void => {
        isClosing.current = false;
        setInvalid(false);
        setDraft(name);
    };

    /** Leaving the field by itself sends the focus nowhere: it is already elsewhere. */
    const close = (toTrigger: boolean): void => {
        isClosing.current = true;
        restoreFocus.current = toTrigger;
        setDraft(null);
    };

    const save = async (leaving: boolean): Promise<void> => {
        const next = (draft ?? '').trim();

        if (saving || isClosing.current) {
            return;
        }

        if (next === name || (next === '' && leaving)) {
            close(!leaving);

            return;
        }

        if (next === '') {
            field.current?.setCustomValidity(t('The name is required.'));
            field.current?.reportValidity();
            setInvalid(true);

            return;
        }

        setSaving(true);

        try {
            await onRename(next);
            close(!leaving && document.activeElement === field.current);
        } catch {
            setInvalid(true);
        }

        setSaving(false);
    };

    const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void save(false);

            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            close(true);
        }
    };

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        if (event.key !== 'F2') {
            return;
        }

        event.preventDefault();
        open();
    };

    return (
        <span className="flex min-w-0 items-center gap-1">
            <h1 className={className}>
                {/* The same height in both states, so the line above the name stays where it is in the bar. */}
                <span
                    className={cn('block px-1', isEditing ? 'py-0.5' : 'py-1')}
                >
                    {isEditing ? (
                        <Input
                            ref={field}
                            autoFocus
                            maxLength={maxLength}
                            value={draft}
                            readOnly={saving}
                            aria-busy={saving || undefined}
                            aria-invalid={invalid || undefined}
                            aria-label={nameLabel}
                            onChange={(event) => {
                                event.target.setCustomValidity('');
                                setInvalid(false);
                                setDraft(event.target.value);
                            }}
                            onKeyDown={onFieldKeyDown}
                            onBlur={() => void save(true)}
                            onFocus={(event) => event.target.select()}
                            className="h-7 w-64 max-w-full text-base font-semibold"
                        />
                    ) : (
                        <button
                            ref={trigger}
                            type="button"
                            title={renameLabel}
                            aria-description={renameLabel}
                            aria-keyshortcuts="F2"
                            onClick={open}
                            onKeyDown={onTriggerKeyDown}
                            className="block max-w-full truncate rounded-sm text-left outline-offset-2 outline-ring hover:bg-accent focus-visible:outline-2"
                        >
                            {name}
                        </button>
                    )}
                </span>
            </h1>
            {!isEditing && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={renameLabel}
                    aria-keyshortcuts="F2"
                    onClick={open}
                    onKeyDown={onTriggerKeyDown}
                    className="hidden shrink-0 2xl:inline-flex"
                >
                    <Pencil aria-hidden />
                </Button>
            )}
        </span>
    );
}

export function SessionTitle({
    backHref,
    onBack,
    overline,
    subtitle,
    badges,
    onRename,
    renameLabel,
    nameLabel,
    nameMaxLength = NameMaxLength,
    children,
}: SessionTitleProps) {
    const { t } = useTrans();
    const headingClassName = 'min-w-0 truncate text-base font-semibold';

    return (
        <span className="flex min-w-0 items-center gap-2">
            {onBack && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Back to the team')}
                    onClick={onBack}
                >
                    <ArrowLeft aria-hidden />
                </Button>
            )}
            {backHref && !onBack && (
                <Button asChild variant="ghost" size="icon-sm">
                    <Link href={backHref} aria-label={t('Back to the team')}>
                        <ArrowLeft aria-hidden />
                    </Link>
                </Button>
            )}
            <span className="flex min-w-0 flex-col">
                {overline && (
                    <span
                        data-slot="session-overline"
                        className="hidden truncate text-xs font-normal text-muted-foreground @session-detail/session:block"
                    >
                        {overline}
                    </span>
                )}
                {onRename && typeof children === 'string' ? (
                    <RenamableName
                        name={children}
                        onRename={onRename}
                        renameLabel={renameLabel ?? t('Rename')}
                        nameLabel={nameLabel ?? t('Session name')}
                        maxLength={nameMaxLength}
                        className={headingClassName}
                    />
                ) : (
                    <h1 className={headingClassName}>{children}</h1>
                )}
                {subtitle && (
                    <span
                        data-slot="session-subtitle"
                        className="text-xs font-medium break-words text-muted-foreground md:hidden"
                    >
                        {subtitle}
                    </span>
                )}
            </span>
            {badges}
        </span>
    );
}
