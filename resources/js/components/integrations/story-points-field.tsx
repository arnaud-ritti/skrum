import { router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import JiraFieldDetectionsController from '@/actions/App/Http/Controllers/Integrations/JiraFieldDetectionsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { LoadingButton } from '@/components/skrum/loading-button';
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

type Pending = 'field' | 'detection' | null;

/** The story points field of a Jira Cloud or Jira Data Center connection. */
export function StoryPointsField({ scope, connection }: Props) {
    const { t } = useTrans();
    const [pending, setPending] = useState<Pending>(null);
    const numberFields = connection.settings.numberFields ?? [];
    const storyPointFields = connection.settings.storyPointFields ?? [];
    const target = { ...scope, integration: connection.id };

    const send = async (
        kind: Exclude<Pending, null>,
        request: Promise<unknown>,
        successMessage: string,
    ) => {
        setPending(kind);

        try {
            await request;
            toast.success(successMessage);
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setPending(null);
        }
    };

    const chooseField = (fieldId: string) =>
        void send(
            'field',
            retroRequest(TeamIntegrationsController.update(target), {
                story_point_field_id: fieldId,
            }),
            t('Story points field saved.'),
        );

    const detect = () =>
        void send(
            'detection',
            retroRequest(JiraFieldDetectionsController.store(target)),
            t('Fields detected again.'),
        );

    return (
        <div
            data-slot="story-points-field"
            className="flex min-w-0 flex-col gap-1.5"
        >
            <p className="text-sm font-medium">{t('Story points field')}</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                {numberFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No story points field found.')}
                    </p>
                ) : (
                    <Select
                        disabled={pending !== null}
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
                    <LoadingButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full"
                        loading={pending === 'detection'}
                        disabled={pending !== null}
                        onClick={detect}
                    >
                        <RefreshCw aria-hidden="true" />
                        <span className="truncate">{t('Detect again')}</span>
                    </LoadingButton>
                )}
            </div>
        </div>
    );
}
