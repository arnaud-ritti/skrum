import { Head, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminShell } from '@/components/admin/admin-shell';
import {
    ConfirmationLine,
    useFreshConfirmation,
} from '@/components/admin/configuration/confirmation-line';
import { DefaultWorkspaceCard } from '@/components/admin/default-workspace-card';
import type { DefaultWorkspaceCardProps } from '@/components/admin/default-workspace-card';
import { SignInSettingsForm } from '@/components/admin/sign-in-settings-form';
import type { SignInSettingsFormProps } from '@/components/admin/sign-in-settings-form';
import { ProviderCard } from '@/components/admin/sso/provider-card';
import { useTrans } from '@/hooks/use-trans';
import type {
    SsoLastTest,
    SsoProviderDetails,
    SsoProviderKey,
} from '@/lib/admin/types';

type Props = Omit<SignInSettingsFormProps, 'frame'> &
    Omit<DefaultWorkspaceCardProps, 'workspaces'> & {
        /** Not `workspaces`: that shared prop is the sidebar's, with their slugs. */
        defaultWorkspaceOptions: DefaultWorkspaceCardProps['workspaces'];
        providerDetails: SsoProviderDetails[];
        lastTest: SsoLastTest | null;
        /** End of the fresh password confirmation that configuration writes need (rule S2). */
        confirmedUntil: string | null;
        confirmUrl: string;
    };

/** Changes of these values mean the server stored something new for the provider. */
function providerSignature(provider: SsoProviderDetails): string {
    return JSON.stringify([
        provider.configured,
        provider.fields,
        provider.secretChangedAt,
    ]);
}

export default function SignInSettings({
    providerDetails,
    lastTest,
    confirmedUntil,
    confirmUrl,
    defaultWorkspaceId,
    defaultWorkspaceOptions,
    ...props
}: Props) {
    const { t } = useTrans();
    const flashedTest = usePage().flash.ssoTest ?? null;
    const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);
    const [editing, setEditing] = useState<SsoProviderKey | null>(null);
    const { needsConfirmation, refuse } = useFreshConfirmation(confirmedUntil);
    const editingLabel =
        providerDetails.find((provider) => provider.key === editing)?.label ??
        null;
    const dirtyHandlers = useMemo(
        () =>
            Object.fromEntries(
                providerDetails.map((provider) => [
                    provider.key,
                    (dirty: boolean) =>
                        setEditing((current) => {
                            if (dirty) {
                                return current ?? provider.key;
                            }

                            return current === provider.key ? null : current;
                        }),
                ]),
            ),
        [providerDetails],
    );

    /*
     * One card is edited at a time: the topbar's unsaved-changes bar belongs to
     * the card being edited, and to the "SSO required" form otherwise. A card is
     * remounted after a save, so that it starts again from what was stored.
     */
    return (
        <AdminShell
            active="signIn"
            actions={<div ref={setBarSlot} className="contents" />}
        >
            <Head title={t('SSO authentication')} />
            <div className="flex min-w-0 flex-col gap-8">
                <ConfirmationLine
                    visible={needsConfirmation}
                    confirmUrl={confirmUrl}
                />
                <div className="grid min-w-0 gap-8 xl:grid-cols-2">
                    {providerDetails.map((provider) => (
                        <ProviderCard
                            key={`${provider.key}:${providerSignature(provider)}`}
                            provider={provider}
                            needsConfirmation={needsConfirmation}
                            onConfirmationRefused={refuse}
                            lockedBy={
                                editing !== null && editing !== provider.key
                                    ? editingLabel
                                    : null
                            }
                            onDirtyChange={dirtyHandlers[provider.key]}
                            barSlot={barSlot}
                            lastTest={
                                lastTest?.provider === provider.key
                                    ? lastTest
                                    : null
                            }
                            testResult={
                                lastTest?.provider === provider.key
                                    ? flashedTest
                                    : null
                            }
                        />
                    ))}
                </div>
                <SignInSettingsForm
                    {...props}
                    frame={(bar, content) => (
                        <>
                            {barSlot !== null &&
                                editing === null &&
                                createPortal(bar, barSlot)}
                            {content}
                        </>
                    )}
                />
                <DefaultWorkspaceCard
                    key={defaultWorkspaceId ?? ''}
                    defaultWorkspaceId={defaultWorkspaceId}
                    workspaces={defaultWorkspaceOptions}
                />
            </div>
        </AdminShell>
    );
}
