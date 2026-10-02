import { router } from '@inertiajs/react';
import { Braces } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Checkbox } from '@/components/ui/checkbox';
import { CollapsibleBlock } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    TeamIntegration,
    WebhookEventName,
    WebhookEventOption,
} from '@/types';

const PayloadExample = `{
  "version": 1,
  "id": "4f1c2e9a-8d3b-4b8e-9f51-2a7c0d6e5b13",
  "event": "action_item.completed",
  "occurredAt": "2026-10-07T10:00:00Z",
  "sentAt": "2026-10-07T10:00:02Z",
  "team": { "id": "…", "name": "Platform" },
  "data": {
    "actionItem": {
      "id": "…",
      "content": "Fix the deploy",
      "status": "completed",
      "assignee": { "name": "Ada" },
      "createdBy": { "name": "Fran" },
      "completedBy": { "name": "Ada" },
      "dueOn": "2026-10-15",
      "priority": "high",
      "completedAt": "2026-10-07T10:00:00Z",
      "url": "https://skrum.example.com/w/acme/action-items?item=…",
      "retro": { "id": "…", "title": "Sprint 42", "url": "…" },
      "themeName": null,
      "createdAt": "2026-10-01T09:30:00Z"
    },
    "origin": "skrum",
    "completedVia": null
  }
}`;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    events: WebhookEventOption[];
};

export function WebhookEventsPanel({ scope, connection, events }: Props) {
    const { t } = useTrans();
    const titleId = useId();
    const saved = connection.settings.events ?? [];
    const [selected, setSelected] = useState<WebhookEventName[]>(saved);
    const [busy, setBusy] = useState(false);
    const changed =
        selected.length !== saved.length ||
        selected.some((name) => !saved.includes(name));

    const toggle = (name: WebhookEventName, checked: boolean) =>
        setSelected((current) =>
            checked
                ? [...current, name]
                : current.filter((selectedName) => selectedName !== name),
        );

    const save = async () => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    ...scope,
                    integration: connection.id,
                }),
                { events: selected },
            );
            toast.success(t('Events saved.'));
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section
            aria-labelledby={titleId}
            data-slot="webhook-events"
            className="flex min-w-0 flex-col gap-3 border-t pt-4"
        >
            <div className="flex min-w-0 flex-col gap-0.5">
                <h4 id={titleId} className="text-sm font-semibold">
                    {t('Send automatically')}
                </h4>
                <p className="text-body-sm text-muted-foreground">
                    {t('Only the events you tick are sent, as they happen.')}
                </p>
            </div>
            <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
                {events.map((event) => {
                    const id = `webhook-event-${event.name}`;

                    return (
                        <li
                            key={event.name}
                            className="flex min-w-0 items-start gap-3 px-3 py-2.5"
                        >
                            <Checkbox
                                id={id}
                                className="mt-0.5"
                                checked={selected.includes(event.name)}
                                onCheckedChange={(checked) =>
                                    toggle(event.name, checked === true)
                                }
                            />
                            <Label
                                htmlFor={id}
                                className="grid min-w-0 flex-1 gap-0.5 font-normal"
                            >
                                <code className="font-mono text-xs font-medium break-all">
                                    {event.name}
                                </code>
                                <span className="text-body-sm text-muted-foreground">
                                    {event.description}
                                </span>
                            </Label>
                        </li>
                    );
                })}
            </ul>
            <CollapsibleBlock
                trigger={{ icon: Braces, label: t('Payload reference') }}
            >
                <pre className="overflow-x-auto font-mono text-xs">
                    {PayloadExample}
                </pre>
            </CollapsibleBlock>
            <LoadingButton
                type="button"
                size="sm"
                className="max-w-full self-start"
                disabled={!changed}
                loading={busy}
                onClick={() => void save()}
            >
                <span className="truncate">{t('Save events')}</span>
            </LoadingButton>
        </section>
    );
}
