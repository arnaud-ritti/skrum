import { CircleAlert, GripVertical, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
    BreakCard,
    DeckMaxNameLength,
    DeckMaxValueLength,
    DeckMaxValues,
    DeckMinValues,
    DeckPreviewCard,
    DeckPreviewStrip,
    UnknownCard,
    deckCards,
    isSpecialCard,
} from '@/components/skrum/deck-picker';
import type { Deck } from '@/components/skrum/deck-picker';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type DeckDraft = Omit<Deck, 'id' | 'source'>;

export interface DeckEditorProps {
    value: DeckDraft;
    onChange: (deck: DeckDraft) => void;
    errors?: { name?: string; values?: string };
    saving?: boolean;
    nameRequired?: boolean;
    /**
     * Hides the name field, where the deck cannot be saved under a name:
     * the deck of a running game. The save button then asks for no name.
     */
    withoutName?: boolean;
    saveLabel?: string;
    /**
     * Prefix of the control ids: `-name`, `-cards`, `-unknown`, `-coffee`.
     * The default gives the ids the game settings always had
     * (`deck-new-name`…); pass another prefix when two editors share a page.
     */
    idPrefix?: string;
    onSave: () => void;
    onCancel: () => void;
    className?: string;
}

export function normalizeDeckValue(raw: string): string {
    const trimmed = raw.trim();

    return trimmed === '0.5' || trimmed === '0,5' ? '½' : trimmed;
}

type ValueProblem =
    | { kind: 'empty' }
    | { kind: 'tooLong' }
    | { kind: 'special' }
    | { kind: 'duplicate'; value: string }
    | { kind: 'full' };

export function checkDeckValue(
    candidate: string,
    existing: string[],
): ValueProblem | null {
    if (candidate === '') {
        return { kind: 'empty' };
    }

    if (Array.from(candidate).length > DeckMaxValueLength) {
        return { kind: 'tooLong' };
    }

    if (isSpecialCard(candidate)) {
        return { kind: 'special' };
    }

    if (existing.includes(candidate)) {
        return { kind: 'duplicate', value: candidate };
    }

    if (existing.length >= DeckMaxValues) {
        return { kind: 'full' };
    }

    return null;
}

function SpecialCardRow({
    id,
    card,
    title,
    description,
    checked,
    onCheckedChange,
}: {
    id: string;
    card: string;
    title: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    const labelId = useId();

    return (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b py-2">
            <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-sm bg-muted font-display text-sm font-bold text-muted-foreground"
            >
                {card}
            </span>
            <span className="min-w-0">
                <span
                    id={labelId}
                    className="block truncate text-sm font-semibold"
                >
                    {title}
                </span>
                <span className="block text-xs text-muted-foreground">
                    {description}
                </span>
            </span>
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                aria-labelledby={labelId}
                className="cursor-pointer"
            />
        </div>
    );
}

export function DeckEditor({
    value,
    onChange,
    errors,
    saving = false,
    nameRequired = true,
    withoutName = false,
    saveLabel,
    idPrefix = 'deck-new',
    onSave,
    onCancel,
    className,
}: DeckEditorProps) {
    const { t } = useTrans();
    const nameId = `${idPrefix}-name`;
    const nameErrorId = useId();
    const nameHelpId = useId();
    const valuesLabelId = useId();
    const valuesMessageId = useId();
    const valuesHelpId = useId();
    const addInputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
    const isLeavingEditByKey = useRef(false);
    const [draft, setDraft] = useState('');
    const [problem, setProblem] = useState<ValueProblem | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');
    const [armedLast, setArmedLast] = useState(false);
    const [touched, setTouched] = useState(false);
    const [announcement, setAnnouncement] = useState('');

    /**
     * A host dialog closes on Escape from a capture listener on the document,
     * before React sees the key. While a chip is edited, Escape belongs to
     * the chip: the event is marked handled on its way down, from the window.
     */
    useEffect(() => {
        if (editingIndex === null) {
            return;
        }

        const claimEscape = (event: globalThis.KeyboardEvent): void => {
            if (
                event.key === 'Escape' &&
                event.target === editInputRef.current
            ) {
                event.preventDefault();
            }
        };

        window.addEventListener('keydown', claimEscape, true);

        return () => window.removeEventListener('keydown', claimEscape, true);
    }, [editingIndex]);

    const values = value.values;
    const tooFew = values.length < DeckMinValues;

    function problemMessage(found: ValueProblem): string {
        switch (found.kind) {
            case 'tooLong':
                return t('Values are :count characters at most.', {
                    count: DeckMaxValueLength,
                });
            case 'special':
                return t('Use the switches below for ? and ☕.');
            case 'duplicate':
                return t('Duplicate value: :value', { value: found.value });
            case 'full':
                return t('A deck has :count values at most.', {
                    count: DeckMaxValues,
                });
            case 'empty':
                return '';
        }
    }

    const valuesMessage =
        errors?.values ??
        (problem && problem.kind !== 'empty'
            ? problemMessage(problem)
            : undefined) ??
        (touched && tooFew
            ? t('Add at least :count values.', { count: DeckMinValues })
            : undefined);

    const saveDisabled =
        saving ||
        tooFew ||
        (!withoutName && nameRequired && value.name.trim() === '');

    function setValues(next: string[], message: string) {
        onChange({ ...value, values: next });
        setAnnouncement(message);
        setTouched(true);
    }

    function focusChip(index: number) {
        requestAnimationFrame(() => chipRefs.current.get(index)?.focus());
    }

    function addDraft() {
        const candidate = normalizeDeckValue(draft);
        const found = checkDeckValue(candidate, values);

        if (found?.kind === 'empty') {
            return;
        }

        if (found) {
            setProblem(found);

            return;
        }

        setProblem(null);
        setDraft('');
        setValues(
            [...values, candidate],
            t('Added :value', { value: candidate }),
        );
    }

    /** A pasted or filled list ("1, 2, 3"): every valid part becomes a value. */
    function addList(text: string) {
        const next = [...values];
        const refused: string[] = [];
        let firstProblem: ValueProblem | null = null;

        for (const part of text.split(',')) {
            const candidate = normalizeDeckValue(part);
            const found = checkDeckValue(candidate, next);

            if (found === null) {
                next.push(candidate);

                continue;
            }

            if (found.kind !== 'empty') {
                refused.push(candidate);
                firstProblem ??= found;
            }
        }

        setDraft(refused.join(', '));
        setProblem(firstProblem);

        if (next.length > values.length) {
            setValues(
                next,
                t('Added :value', {
                    value: next.slice(values.length).join(', '),
                }),
            );
        }
    }

    function removeAt(index: number) {
        const removed = values[index];

        setValues(
            values.filter((_, position) => position !== index),
            t('Removed :value', { value: removed }),
        );
        setArmedLast(false);

        if (index > 0) {
            focusChip(index - 1);

            return;
        }

        requestAnimationFrame(() => addInputRef.current?.focus());
    }

    function moveChip(index: number, direction: -1 | 1) {
        const target = index + direction;

        if (target < 0 || target >= values.length) {
            return;
        }

        const next = [...values];
        [next[index], next[target]] = [next[target], next[index]];
        setValues(
            next,
            t('Moved :value to position :position', {
                value: values[index],
                position: target + 1,
            }),
        );
        focusChip(target);
    }

    function startEditing(index: number) {
        isLeavingEditByKey.current = false;
        setEditingIndex(index);
        setEditingText(values[index]);
        setProblem(null);
    }

    /**
     * Enter keeps focus on the chip. Leaving the field (Tab, click elsewhere)
     * saves a valid edit and restores the chip otherwise, and never pulls
     * focus back.
     */
    function commitEditing(trigger: 'key' | 'blur') {
        if (editingIndex === null) {
            return;
        }

        const index = editingIndex;
        const candidate = normalizeDeckValue(editingText);
        const refocus = trigger === 'key';

        if (candidate === values[index]) {
            leaveEditing(index, refocus);

            return;
        }

        const found = checkDeckValue(
            candidate,
            values.filter((_, position) => position !== index),
        );

        if (found && trigger === 'key') {
            setProblem(found);

            return;
        }

        if (found) {
            leaveEditing(index, false);
            setProblem(found.kind === 'empty' ? null : found);
            setAnnouncement(t('Kept :value', { value: values[index] }));

            return;
        }

        leaveEditing(index, refocus);
        setValues(
            values.map((existing, position) =>
                position === index ? candidate : existing,
            ),
            t('Changed :from to :to', { from: values[index], to: candidate }),
        );
    }

    function leaveEditing(index: number, refocus: boolean) {
        isLeavingEditByKey.current = refocus;
        setEditingIndex(null);
        setProblem(null);

        if (refocus) {
            focusChip(index);
        }
    }

    function cancelEditing() {
        if (editingIndex !== null) {
            leaveEditing(editingIndex, true);
        }
    }

    function onChipKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ) {
        if (event.key === 'Enter' || event.key === 'F2') {
            event.preventDefault();
            startEditing(index);

            return;
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            removeAt(index);

            return;
        }

        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
            return;
        }

        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;

        if (event.altKey) {
            moveChip(index, direction);

            return;
        }

        const target = index + direction;

        if (target >= values.length) {
            addInputRef.current?.focus();

            return;
        }

        if (target >= 0) {
            chipRefs.current.get(target)?.focus();
        }
    }

    function onAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addDraft();

            return;
        }

        if (event.key === 'Backspace' && draft === '' && values.length > 0) {
            event.preventDefault();

            if (armedLast) {
                removeAt(values.length - 1);

                return;
            }

            setArmedLast(true);
            setAnnouncement(
                t('Press Backspace again to remove :value', {
                    value: values[values.length - 1],
                }),
            );

            return;
        }

        if (event.key === 'ArrowLeft' && draft === '' && values.length > 0) {
            event.preventDefault();
            chipRefs.current.get(values.length - 1)?.focus();
        }
    }

    const preview: DeckDraft = value;
    const cardCount = deckCards(preview).length;

    return (
        <div
            data-slot="deck-editor"
            className={cn('@container/deck min-w-0', className)}
        >
            <div className="grid gap-5 p-5 @3xl/deck:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                    {withoutName ? null : (
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor={nameId}
                                className="text-sm font-semibold"
                            >
                                {nameRequired
                                    ? t('Name')
                                    : t('Name (optional)')}
                            </label>
                            <Input
                                id={nameId}
                                maxLength={DeckMaxNameLength}
                                value={value.name}
                                onChange={(event) =>
                                    onChange({
                                        ...value,
                                        name: event.target.value,
                                    })
                                }
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter') {
                                        return;
                                    }

                                    event.preventDefault();

                                    if (!saveDisabled) {
                                        onSave();
                                    }
                                }}
                                aria-invalid={errors?.name ? true : undefined}
                                aria-describedby={
                                    errors?.name
                                        ? nameErrorId
                                        : nameRequired
                                          ? undefined
                                          : nameHelpId
                                }
                            />
                            {!nameRequired && !errors?.name ? (
                                <p
                                    id={nameHelpId}
                                    className="text-xs text-muted-foreground"
                                >
                                    {t(
                                        'Give it a name to save this deck for the team.',
                                    )}
                                </p>
                            ) : null}
                            {errors?.name ? (
                                <p
                                    id={nameErrorId}
                                    className="flex items-center gap-1.5 text-xs text-skrum-destructive-text"
                                >
                                    <CircleAlert
                                        aria-hidden="true"
                                        className="size-3.5 shrink-0"
                                    />
                                    {errors.name}
                                </p>
                            ) : null}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <span
                            id={valuesLabelId}
                            className="text-sm font-semibold"
                        >
                            {t('Values')}
                        </span>
                        <ul
                            role="list"
                            aria-labelledby={valuesLabelId}
                            aria-invalid={valuesMessage ? true : undefined}
                            aria-describedby={
                                valuesMessage ? valuesMessageId : valuesHelpId
                            }
                            data-slot="deck-values-input"
                            onClick={(event) => {
                                if (event.target === event.currentTarget) {
                                    addInputRef.current?.focus();
                                }
                            }}
                            className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-1.5 has-[[data-slot=deck-add-input]:focus-visible]:border-ring has-[[data-slot=deck-add-input]:focus-visible]:ring-2 has-[[data-slot=deck-add-input]:focus-visible]:ring-ring aria-invalid:border-destructive"
                        >
                            {values.map((chip, index) => (
                                <li
                                    key={chip}
                                    data-slot="deck-chip"
                                    data-editing={
                                        editingIndex === index || undefined
                                    }
                                    className={cn(
                                        'inline-flex h-7.5 max-w-full min-w-0 items-center gap-0.5 rounded-sm border bg-muted pr-0.5 pl-1.5 font-display text-sm font-bold whitespace-nowrap',
                                        editingIndex === index &&
                                            'bg-card ring-2 ring-ring ring-offset-1 ring-offset-background',
                                    )}
                                >
                                    <GripVertical
                                        aria-hidden="true"
                                        className="size-3.5 shrink-0 text-muted-foreground"
                                    />
                                    {editingIndex === index ? (
                                        <input
                                            ref={editInputRef}
                                            autoFocus
                                            value={editingText}
                                            aria-label={t('Edit value :value', {
                                                value: chip,
                                            })}
                                            onChange={(event) => {
                                                setEditingText(
                                                    event.target.value,
                                                );
                                                setProblem(null);
                                            }}
                                            onBlur={() => {
                                                if (
                                                    !isLeavingEditByKey.current
                                                ) {
                                                    commitEditing('blur');
                                                }
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    commitEditing('key');
                                                }

                                                if (event.key === 'Escape') {
                                                    event.preventDefault();
                                                    cancelEditing();
                                                }
                                            }}
                                            className="h-6 w-24 max-w-full min-w-0 bg-transparent px-1 text-sm font-bold outline-none"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            ref={(node) => {
                                                if (node) {
                                                    chipRefs.current.set(
                                                        index,
                                                        node,
                                                    );

                                                    return;
                                                }

                                                chipRefs.current.delete(index);
                                            }}
                                            onDoubleClick={() =>
                                                startEditing(index)
                                            }
                                            onKeyDown={(event) =>
                                                onChipKeyDown(event, index)
                                            }
                                            aria-label={t('Value :value', {
                                                value: chip,
                                            })}
                                            aria-keyshortcuts="Enter Alt+ArrowLeft Alt+ArrowRight Delete"
                                            className={cn(
                                                'h-6 rounded-xs px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                armedLast &&
                                                    index ===
                                                        values.length - 1 &&
                                                    'bg-accent',
                                            )}
                                        >
                                            {chip}
                                        </button>
                                    )}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                aria-label={t('Remove :value', {
                                                    value: chip,
                                                })}
                                                onClick={() => removeAt(index)}
                                                className="grid size-5.5 place-items-center rounded-xs text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <X
                                                    aria-hidden="true"
                                                    className="size-3.5"
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {t('Remove :value', {
                                                value: chip,
                                            })}
                                        </TooltipContent>
                                    </Tooltip>
                                </li>
                            ))}
                            <li className="flex min-w-24 flex-1 items-center gap-1.5">
                                <input
                                    ref={addInputRef}
                                    id={`${idPrefix}-cards`}
                                    data-slot="deck-add-input"
                                    value={draft}
                                    onChange={(event) => {
                                        setArmedLast(false);

                                        if (event.target.value.includes(',')) {
                                            addList(event.target.value);

                                            return;
                                        }

                                        setDraft(event.target.value);
                                        setProblem(null);
                                    }}
                                    onKeyDown={onAddKeyDown}
                                    onBlur={() => setArmedLast(false)}
                                    aria-label={t('Add a value')}
                                    placeholder={t('Add a value')}
                                    className="h-7 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                                />
                                <kbd
                                    aria-hidden="true"
                                    className="hidden rounded-xs border bg-muted px-1 font-sans text-xs text-muted-foreground @sm/deck:inline"
                                >
                                    ↵
                                </kbd>
                            </li>
                        </ul>
                        {valuesMessage ? (
                            <p
                                id={valuesMessageId}
                                className="flex items-center gap-1.5 text-xs text-skrum-destructive-text"
                            >
                                <CircleAlert
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0"
                                />
                                {valuesMessage}
                            </p>
                        ) : (
                            <p
                                id={valuesHelpId}
                                className="text-xs text-muted-foreground"
                            >
                                {t(
                                    ':min to :max values, :length characters each. Order is the order of the deck.',
                                    {
                                        min: DeckMinValues,
                                        max: DeckMaxValues,
                                        length: DeckMaxValueLength,
                                    },
                                )}
                            </p>
                        )}
                        <div
                            aria-live="polite"
                            role="status"
                            className="sr-only"
                        >
                            {announcement}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                            {t('Special cards')}
                        </span>
                        <SpecialCardRow
                            id={`${idPrefix}-unknown`}
                            card={UnknownCard}
                            title={t("I don't know")}
                            description={t(
                                'Abstain without skewing the result.',
                            )}
                            checked={value.unknownCard}
                            onCheckedChange={(unknownCard) =>
                                onChange({ ...value, unknownCard })
                            }
                        />
                        <SpecialCardRow
                            id={`${idPrefix}-coffee`}
                            card={BreakCard}
                            title={t('I need a break')}
                            description={t('Ask the team for a pause.')}
                            checked={value.breakCard}
                            onCheckedChange={(breakCard) =>
                                onChange({ ...value, breakCard })
                            }
                        />
                    </div>
                </div>

                <div
                    data-slot="deck-preview"
                    className="flex min-w-0 flex-col gap-3 self-start rounded-lg border bg-skrum-canvas p-4"
                >
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                            {t('Preview · :count cards', { count: cardCount })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {t('Order and look of the deck seen by voters.')}
                        </span>
                    </div>
                    {cardCount === 0 ? (
                        <DeckPreviewCard value="…" />
                    ) : (
                        <DeckPreviewStrip
                            deck={preview}
                            label={t('Preview · :count cards', {
                                count: cardCount,
                            })}
                        />
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
                {saveDisabled && !saving && tooFew ? (
                    <span className="mr-auto min-w-0 text-xs text-muted-foreground">
                        {t('Add at least :count values.', {
                            count: DeckMinValues,
                        })}
                    </span>
                ) : null}
                <Button
                    type="button"
                    variant="outline"
                    className="max-w-full min-w-0"
                    onClick={onCancel}
                >
                    <span className="truncate">{t('Cancel')}</span>
                </Button>
                <LoadingButton
                    type="button"
                    loading={saving}
                    disabled={saveDisabled}
                    className="max-w-full min-w-0"
                    onClick={onSave}
                >
                    <span className="truncate">
                        {saveLabel ?? t('Save deck')}
                    </span>
                </LoadingButton>
            </div>
        </div>
    );
}
