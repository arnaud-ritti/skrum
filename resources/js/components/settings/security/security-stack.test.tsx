import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SecurityStack } from './security-stack';

describe('SecurityStack', () => {
    it('renders nothing in the places left while they are empty', () => {
        const { container } = render(
            <SecurityStack>
                <section>Password</section>
                <section>Passkeys</section>
            </SecurityStack>,
        );

        expect(container.textContent).toBe('PasswordPasskeys');
        expect(container.children.length).toBe(2);
    });

    it('puts the active sessions, then the linked accounts, under the cards', () => {
        const { container } = render(
            <SecurityStack
                activeSessions={<section>Active sessions</section>}
                linkedAccounts={<section>Linked accounts</section>}
            >
                <section>Passkeys</section>
            </SecurityStack>,
        );

        expect(
            [...container.children].map((child) => child.textContent),
        ).toEqual(['Passkeys', 'Active sessions', 'Linked accounts']);
    });
});
