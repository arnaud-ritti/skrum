import { router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import JiraFieldDetectionsController from '@/actions/App/Http/Controllers/Integrations/JiraFieldDetectionsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, TeamIntegration } from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

/** The story points field of a Jira Cloud or Jira Data Center connection. */
export function StoryPointsField({ scope, connection }: Props) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const numberFields = connection.settings.numberFields ?? [];
    const storyPointFields = connection.settings.storyPointFields ?? [];
    const target = { ...scope, integration: connection.id };

    const send = async (request: Promise<unknown>, successMessage: string) => {
        setBusy(true);

        try {
            await request;
            toast.success(successMessage);
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const chooseField = (fieldId: string) =>
        void send(
            retroRequest(TeamIntegrationsController.update(target), {
                story_point_field_id: fieldId,
            }),
            t('Story points field saved.'),
        );

    const detect = () =>
        void send(
            retroRequest(JiraFieldDetectionsController.store(target)),
            t('Fields detected again.'),
        );

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">{t('Story points field')}</p>
            <div className="flex flex-wrap items-center gap-2">
                {numberFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No story points field found.')}
                    </p>
                ) : (
                    <Select
                        disabled={busy}
                        value={storyPointFields[0]?.id}
                        onValueChange={chooseField}
                    >
                        <SelectTrigger
                            className="w-full sm:w-72"
                            aria-label={t('Story points field')}
                        >
                            <SelectValue placeholder={t('Choose a field')} />
                        </SelectTrigger>
                        <SelectContent>
                            {numberFields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                    {field.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {connection.status === 'active' && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={detect}
                    >
                        <RefreshCw className="size-4" aria-hidden />
                        {t('Detect again')}
                    </Button>
                )}
            </div>
        </div>
    );
}
