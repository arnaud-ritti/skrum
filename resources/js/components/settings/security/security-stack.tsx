import type { ReactElement, ReactNode } from 'react';

type SecurityStackProps = {
    /** The cards of today: password, two-factor authentication, passkeys. */
    children: ReactNode;
    /** Place left under the passkeys for the Active sessions card (AC-2). */
    activeSessions?: ReactNode;
    /** Place left under the sessions for the Linked accounts card (AC-3). */
    linkedAccounts?: ReactNode;
};

export function SecurityStack({
    children,
    activeSessions,
    linkedAccounts,
}: SecurityStackProps): ReactElement {
    return (
        <>
            {children}
            {activeSessions}
            {linkedAccounts}
        </>
    );
}
