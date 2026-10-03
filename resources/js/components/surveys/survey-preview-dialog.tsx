import type { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';

type SurveyPreviewDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** The participant view in its preview mode, fed by the builder's state; it saves no answer. */
    children: ReactNode;
};

/** "Preview": the survey as a participant sees it, inside the builder. */
export function SurveyPreviewDialog({
    open,
    onOpenChange,
    title,
    children,
}: SurveyPreviewDialogProps) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-skrum-canvas sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t('Preview')}</DialogTitle>
                    <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <div data-slot="survey-preview" className="min-w-0">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
