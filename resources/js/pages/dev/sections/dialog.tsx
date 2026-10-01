import { ClipboardListIcon, MessageSquareIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

type StateKey =
    | 'confirm'
    | 'destructive'
    | 'consequences'
    | 'pending'
    | 'form'
    | 'formError'
    | 'formPending'
    | 'unavailable';

const wait = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function State({
    label,
    note,
    children,
}: {
    label: string;
    note: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2 rounded-lg border bg-card p-4 shadow-card">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">{note}</p>
            <div>{children}</div>
        </div>
    );
}

export default function DialogSection() {
    const { t } = useTrans();
    const [openState, setOpenState] = useState<StateKey | null>(null);

    const bind = (key: StateKey) => ({
        open: openState === key,
        onOpenChange: (open: boolean) => setOpenState(open ? key : null),
    });
    const opener = (key: StateKey, label: string) => (
        <Button variant="outline" onClick={() => setOpenState(key)}>
            <span className="truncate">{label}</span>
        </Button>
    );
    const title = t('Delete "Sprint retro 42"?');
    const description = t(
        'The session and everything in it will be removed for the whole team.',
    );

    return (
        <section className="@container grid gap-4 p-6">
            <h2 className="text-lg font-semibold">{t('Dialog')}</h2>
            <div className="grid gap-4 @lg:grid-cols-2">
                <State
                    label={t('Confirmation')}
                    note={t('Default tone, never closes on an outside click.')}
                >
                    {opener('confirm', t('Open confirmation'))}
                </State>
                <State
                    label={t('Destructive confirmation')}
                    note={t('Initial focus lands on Cancel.')}
                >
                    {opener('destructive', t('Open destructive dialog'))}
                </State>
                <State
                    label={t('With consequences')}
                    note={t('Figures on what will be lost.')}
                >
                    {opener('consequences', t('Open with consequences'))}
                </State>
                <State
                    label={t('Confirming')}
                    note={t(
                        'Spinner on the button, footer disabled, Esc ignored.',
                    )}
                >
                    {opener('pending', t('Open and confirm'))}
                </State>
                <State
                    label={t('Short form')}
                    note={t(
                        'Close button, Enter submits, focus on the first field.',
                    )}
                >
                    {opener('form', t('Open form'))}
                </State>
                <State
                    label={t('Field in error')}
                    note={t('The field reports its own error.')}
                >
                    {opener('formError', t('Open form with error'))}
                </State>
                <State
                    label={t('Submitting')}
                    note={t('Submit shows a spinner for three seconds.')}
                >
                    {opener('formPending', t('Open and submit'))}
                </State>
                <State
                    label={t('Removed by someone else')}
                    note={t('Info message and a single Close button.')}
                >
                    {opener('unavailable', t('Open removed state'))}
                </State>
            </div>

            <ConfirmDialog
                {...bind('confirm')}
                title={t('Archive "Sprint retro 42"?')}
                description={t(
                    'The session stays readable but closes to new cards.',
                )}
                confirmLabel={t('Archive')}
                onConfirm={() => wait(300)}
            />
            <ConfirmDialog
                {...bind('destructive')}
                tone="destructive"
                title={title}
                description={description}
                confirmLabel={t('Delete')}
                onConfirm={() => wait(300)}
            />
            <ConfirmDialog
                {...bind('consequences')}
                tone="destructive"
                title={title}
                description={description}
                consequences={[
                    { icon: MessageSquareIcon, label: t('48 cards') },
                    { icon: UsersIcon, label: t('12 participants') },
                    { icon: ClipboardListIcon, label: t('5 action items') },
                ]}
                confirmLabel={t('Delete')}
                onConfirm={() => wait(300)}
            />
            <ConfirmDialog
                {...bind('pending')}
                tone="destructive"
                title={title}
                description={description}
                confirmLabel={t('Delete')}
                onConfirm={() => wait(3000)}
            />
            <ConfirmDialog
                {...bind('unavailable')}
                title={title}
                description={description}
                unavailableMessage={t(
                    'This session was deleted by another facilitator.',
                )}
                confirmLabel={t('Delete')}
                onConfirm={() => wait(300)}
            />

            <FormDialog
                {...bind('form')}
                title={t('New retro')}
                description={t(
                    'Give the session a name your team will recognise.',
                )}
                submitLabel={t('Create')}
                onSubmit={() => wait(300)}
            >
                <div className="grid gap-2">
                    <Label htmlFor="bench-dialog-name">{t('Name')}</Label>
                    <Input id="bench-dialog-name" name="name" />
                </div>
            </FormDialog>
            <FormDialog
                {...bind('formError')}
                title={t('Rename session')}
                submitLabel={t('Save')}
                onSubmit={() => wait(300)}
            >
                <div className="grid gap-2">
                    <Label htmlFor="bench-dialog-error">{t('Name')}</Label>
                    <Input
                        id="bench-dialog-error"
                        name="name"
                        aria-invalid
                        aria-describedby="bench-dialog-error-message"
                    />
                    <p
                        id="bench-dialog-error-message"
                        className="text-sm text-destructive"
                    >
                        {t('The name is required.')}
                    </p>
                </div>
            </FormDialog>
            <FormDialog
                {...bind('formPending')}
                title={t('New retro')}
                submitLabel={t('Create')}
                onSubmit={() => wait(3000)}
            >
                <div className="grid gap-2">
                    <Label htmlFor="bench-dialog-pending">{t('Name')}</Label>
                    <Input id="bench-dialog-pending" name="name" />
                </div>
            </FormDialog>
        </section>
    );
}
