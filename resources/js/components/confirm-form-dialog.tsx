import { Form } from '@inertiajs/react';
import type { ComponentProps, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    trigger: ReactNode;
    title: string;
    description: string;
    confirmLabel: string;
    form: Pick<ComponentProps<typeof Form>, 'action' | 'method' | 'options'>;
    errorKey?: string;
};

export default function ConfirmFormDialog({
    trigger,
    title,
    description,
    confirmLabel,
    form,
    errorKey,
}: Props) {
    const { t } = useTrans();

    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>

                <Form {...form} className="space-y-4">
                    {({ processing, errors }) => (
                        <>
                            {errorKey && (
                                <InputError message={errors[errorKey]} />
                            )}

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        {t('Cancel')}
                                    </Button>
                                </DialogClose>

                                <Button
                                    variant="destructive"
                                    disabled={processing}
                                >
                                    {confirmLabel}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
