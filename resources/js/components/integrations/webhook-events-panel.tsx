import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
        <section className="space-y-3">
            <div>
                <h3 className="text-sm font-medium">
                    {t('Send automatically')}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {t('Only the events you tick are sent, as they happen.')}
                </p>
            </div>
            <ul className="space-y-2">
                {events.map((event) => {
                    const id = `webhook-event-${event.name}`;

                    return (
                        <li key={event.name} className="flex items-start gap-2">
                            <Checkbox
                                id={id}
                                checked={selected.includes(event.name)}
                                onCheckedChange={(checked) =>
                                    toggle(event.name, checked === true)
                                }
                            />
                            <Label
                                htmlFor={id}
                                className="grid gap-0.5 font-normal"
                            >
                                <code className="text-xs">{event.name}</code>
                                <span className="text-sm text-muted-foreground">
                                    {event.description}
                                </span>
                            </Label>
                        </li>
                    );
                })}
            </ul>
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="px-0">
                        {t('Payload reference')}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        {PayloadExample}
                    </pre>
                </CollapsibleContent>
            </Collapsible>
            <Button
                size="sm"
                disabled={!changed || busy}
                onClick={() => void save()}
            >
                {busy && <Spinner />}
                {t('Save events')}
            </Button>
        </section>
    );
}
