import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
    const canRemove = options.length > MinOptions;
    const canAdd = options.length < MaxOptions;

    useEffect(() => {
        if (pendingFocus.current === null) {
            return;
        }

        inputs.current.get(pendingFocus.current)?.focus();
        pendingFocus.current = null;
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
                                aria-invalid={
                                    option.label.trim() === '' || undefined
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
                                onClick={() =>
                                    onChange(
                                        options.filter(
                                            (_, position) => position !== index,
                                        ),
                                    )
                                }
                            >
                                <X aria-hidden />
                            </Button>
                        </li>
                    );
                })}
            </ol>
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
