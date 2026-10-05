import { Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { MaxOptions, MinOptions } from '@/lib/surveys/builder-state';
import type { SurveyOptionPayload } from '@/lib/surveys/types';

const MaxOptionLength = 100;

type BuilderOptionsEditorProps = {
    options: SurveyOptionPayload[];
    onChange: (options: SurveyOptionPayload[]) => void;
};

/**
 * The options of a choice question: 2 to 10, Enter in the last one adds
 * another. Rows are keyed by position: the server gives the options new ids on
 * every save, which must not unmount the field being typed in.
 */
export function BuilderOptionsEditor({
    options,
    onChange,
}: BuilderOptionsEditorProps) {
    const { t } = useTrans();
    const inputs = useRef(new Map<number, HTMLInputElement>());
    const pendingFocus = useRef<number | null>(null);
    const [leftEmpty, setLeftEmpty] = useState<ReadonlySet<number>>(
        () => new Set(),
    );
    const errorId = useId();
    const canRemove = options.length > MinOptions;
    const canAdd = options.length < MaxOptions;

    useEffect(() => {
        const focusIndex = pendingFocus.current;

        pendingFocus.current = null;

        if (focusIndex === null || options.length !== focusIndex + 1) {
            return;
        }

        inputs.current.get(focusIndex)?.focus();
    }, [options.length]);

    const add = (): void => {
        if (!canAdd) {
            return;
        }

        pendingFocus.current = options.length;
        onChange([...options, { id: `new-${options.length}`, label: '' }]);
    };

    return (
        <div data-slot="survey-options-editor" className="flex flex-col gap-2">
            <ol className="flex flex-col gap-2">
                {options.map((option, index) => {
                    const isLast = index === options.length - 1;
                    const isInvalid =
                        leftEmpty.has(index) && option.label.trim() === '';

                    return (
                        <li
                            key={index}
                            className="flex min-w-0 items-center gap-2"
                        >
                            <Input
                                ref={(node) => {
                                    if (node === null) {
                                        inputs.current.delete(index);

                                        return;
                                    }

                                    inputs.current.set(index, node);
                                }}
                                value={option.label}
                                maxLength={MaxOptionLength}
                                aria-label={t('Option :number', {
                                    number: index + 1,
                                })}
                                aria-invalid={isInvalid || undefined}
                                aria-describedby={
                                    isInvalid ? errorId : undefined
                                }
                                onBlur={() =>
                                    setLeftEmpty((known) =>
                                        new Set(known).add(index),
                                    )
                                }
                                onChange={(event) =>
                                    onChange(
                                        options.map((known, position) =>
                                            position === index
                                                ? {
                                                      ...known,
                                                      label: event.target.value,
                                                  }
                                                : known,
                                        ),
                                    )
                                }
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter') {
                                        return;
                                    }

                                    event.preventDefault();

                                    if (isLast) {
                                        add();
                                    }
                                }}
                                className="min-w-0 flex-1"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={!canRemove}
                                aria-label={t('Remove option :number', {
                                    number: index + 1,
                                })}
                                onClick={() => {
                                    setLeftEmpty(new Set());
                                    onChange(
                                        options.filter(
                                            (_, position) => position !== index,
                                        ),
                                    );
                                }}
                            >
                                <X aria-hidden />
                            </Button>
                        </li>
                    );
                })}
            </ol>
            {options.some(
                (option, index) =>
                    leftEmpty.has(index) && option.label.trim() === '',
            ) && (
                <p id={errorId} className="text-xs text-skrum-destructive-text">
                    {t('An option needs a label.')}
                </p>
            )}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canAdd}
                onClick={add}
                className="self-start"
            >
                <Plus aria-hidden />
                {t('Add option')}
            </Button>
        </div>
    );
}
