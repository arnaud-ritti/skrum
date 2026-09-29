import { AlertCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTrans } from '@/hooks/use-trans';

export default function AlertError({
    errors,
    title,
}: {
    errors: string[];
    title?: string;
}) {
    const { t } = useTrans();

    return (
        <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{title || t('Something went wrong.')}</AlertTitle>
            <AlertDescription>
                <ul className="list-inside list-disc text-sm">
                    {Array.from(new Set(errors)).map((error, index) => (
                        <li key={index}>{t(error)}</li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
}
