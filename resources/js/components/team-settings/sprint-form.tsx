import { useId, useState } from 'react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { LoadingButton } from '@/components/skrum/loading-button';
import type { SprintDraft } from '@/components/team-settings/sprint-planning';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';

/** 40rem: below it the form opens in a drawer. */
const DialogMinWidth = 640;

/** `StartNextSprint::MaxNumber`. */
const MaxNumber = 9999;

export type SprintFormErrors = Partial<
    Record<'number' | 'starts_on' | 'ends_on', string>
>;

type SprintFormProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    submitLabel: string;
    initial: SprintDraft;
    /** Editing a sprint: the form says that its days relabel the sessions. */
    editing?: boolean;
    /** Resolves when saved; rejects with the errors of the fields. */
    onSubmit: (draft: SprintDraft) => Promise<void>;
};

function Field({
    id,
    label,
    error,
    children,
}: {
    id: string;
    label: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {children}
            <InputError id={`${id}-error`} message={error} />
        </div>
    );
}

/** Add or edit a sprint: its number, first day and last day. */
export function SprintForm({
    open,
    onOpenChange,
    title,
    submitLabel,
    initial,
    editing = false,
    onSubmit,
}: SprintFormProps): ReactElement {
    const { t } = useTrans();
    const wide = useMinWidth(DialogMinWidth);
    const descriptionId = useId();
    const [number, setNumber] = useState(String(initial.number));
    const [startsOn, setStartsOn] = useState(initial.startsOn);
    const [endsOn, setEndsOn] = useState(initial.endsOn);
    const [errors, setErrors] = useState<SprintFormErrors>({});
    const [saving, setSaving] = useState(false);

    const invalid = (key: keyof SprintFormErrors) =>
        errors[key] === undefined
            ? {}
            : {
                  'aria-invalid': true,
                  'aria-describedby': `${fieldIds[key]}-error`,
              };

    const fieldIds: Record<keyof SprintFormErrors, string> = {
        number: 'sprint-number',
        starts_on: 'sprint-starts-on',
        ends_on: 'sprint-ends-on',
    };

    const close = (next: boolean): void => {
        if (!next && saving) {
            return;
        }

        onOpenChange(next);
    };

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (saving) {
            return;
        }

        setSaving(true);

        try {
            await onSubmit({ number: Number(number), startsOn, endsOn });
            setErrors({});
            setSaving(false);
            onOpenChange(false);
        } catch (failure) {
            setErrors((failure ?? {}) as SprintFormErrors);
            setSaving(false);
        }
    };

    const help = editing
        ? t("Sessions created in these days take this sprint's label.")
        : undefined;

    const fields = (
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Field
                id={fieldIds.number}
                label={t('Number')}
                error={errors.number}
            >
                <Input
                    id={fieldIds.number}
                    name="number"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MaxNumber}
                    required
                    value={number}
                    onChange={(event) => setNumber(event.target.value)}
                    {...invalid('number')}
                />
            </Field>
            <Field
                id={fieldIds.starts_on}
                label={t('First day')}
                error={errors.starts_on}
            >
                <Input
                    id={fieldIds.starts_on}
                    name="starts_on"
                    type="date"
                    required
                    value={startsOn}
                    onChange={(event) => setStartsOn(event.target.value)}
                    {...invalid('starts_on')}
                />
            </Field>
            <Field
                id={fieldIds.ends_on}
                label={t('Last day')}
                error={errors.ends_on}
            >
                <Input
                    id={fieldIds.ends_on}
                    name="ends_on"
                    type="date"
                    required
                    min={startsOn}
                    value={endsOn}
                    onChange={(event) => setEndsOn(event.target.value)}
                    {...invalid('ends_on')}
                />
            </Field>
        </div>
    );

    const buttons = (
        <>
            <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => close(false)}
            >
                {t('Cancel')}
            </Button>
            <LoadingButton type="submit" loading={saving}>
                {submitLabel}
            </LoadingButton>
        </>
    );

    if (!wide) {
        return (
            <Drawer open={open} onOpenChange={close}>
                <DrawerContent
                    closeLabel={t('Close')}
                    aria-describedby={
                        help === undefined ? undefined : descriptionId
                    }
                >
                    <form onSubmit={submit} noValidate className="min-w-0">
                        <DrawerHeader>
                            <DrawerTitle>{title}</DrawerTitle>
                            {help !== undefined && (
                                <DrawerDescription id={descriptionId}>
                                    {help}
                                </DrawerDescription>
                            )}
                        </DrawerHeader>
                        {fields}
                        <DrawerFooter>{buttons}</DrawerFooter>
                    </form>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent
                closeLabel={t('Close')}
                {...(help === undefined
                    ? { 'aria-describedby': undefined }
                    : {})}
            >
                <form
                    onSubmit={submit}
                    noValidate
                    className="grid min-w-0 gap-4"
                >
                    <DialogHeader className="pr-8">
                        <DialogTitle>{title}</DialogTitle>
                        {help !== undefined && (
                            <DialogDescription>{help}</DialogDescription>
                        )}
                    </DialogHeader>
                    {fields}
                    <DialogFooter>{buttons}</DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
