import { describe, expect, it } from 'vitest';
import type { AuditAction, AuditEvent } from '@/lib/admin/types';
import { AuditActions } from '@/lib/admin/types';
import { auditActionLabel } from './audit-action-label';

const t = (key: string, replacements: Record<string, string | number> = {}) =>
    Object.entries(replacements).reduce(
        (line, [name, value]) => line.replaceAll(`:${name}`, String(value)),
        key,
    );

function event(
    action: AuditAction,
    overrides: Partial<AuditEvent> = {},
): AuditEvent {
    return {
        id: 'event-1',
        action,
        group: 'settings',
        actor: { id: 'user-1', name: 'Nadia', avatarUrl: null },
        subject: { type: 'User', id: 'user-2', label: 'Malik' },
        properties: {},
        ownerName: null,
        ip: '203.0.113.7',
        at: '2026-10-15T11:52:00Z',
        ...overrides,
    };
}

describe('auditActionLabel', () => {
    it.each(AuditActions)('gives %s a sentence of its own', (action) => {
        const label = auditActionLabel(event(action), t);

        expect(label).not.toBe('');
        expect(label).not.toBe(action);
        expect(label).not.toMatch(/:[a-z]+/);
    });

    it('gives every action a different sentence', () => {
        const labels = AuditActions.map((action) =>
            auditActionLabel(event(action), t),
        );

        expect(new Set(labels).size).toBe(AuditActions.length);
    });

    it('names the changed and cleared fields of a section and the alert', () => {
        expect(
            auditActionLabel(
                event('configuration_updated', {
                    subject: null,
                    properties: {
                        section: 'sso_oidc',
                        changed: ['client_id'],
                        cleared: ['issuer'],
                        alertSent: true,
                    },
                }),
                t,
            ),
        ).toBe('changed client_id, issuer of OIDC (admins alerted)');
        expect(
            auditActionLabel(
                event('configuration_updated', {
                    subject: null,
                    properties: {
                        section: 'integration_slack',
                        changed: ['client_id'],
                        cleared: [],
                        alertSent: null,
                    },
                }),
                t,
            ),
        ).toBe('changed client_id of Slack');
    });

    it('names the keys and the section of a settings change', () => {
        expect(
            auditActionLabel(
                event('settings_updated', {
                    subject: null,
                    properties: {
                        section: 'general',
                        keys: ['signup_mode', 'maintenance_message'],
                    },
                }),
                t,
            ),
        ).toBe('changed signup_mode, maintenance_message in General');
    });

    it('names the owner of a key an admin revoked', () => {
        expect(
            auditActionLabel(
                event('token_revoked_by_admin', {
                    subject: {
                        type: 'PersonalAccessToken',
                        id: '7',
                        label: null,
                    },
                    properties: { name: 'CI', owner: 'user-2' },
                    ownerName: 'Malik',
                }),
                t,
            ),
        ).toBe('revoked the key CI of Malik');
    });

    it('says a deleted account for a user subject that is gone', () => {
        expect(
            auditActionLabel(
                event('user_deactivated', {
                    subject: { type: 'User', id: 'user-2', label: null },
                }),
                t,
            ),
        ).toBe('deactivated a deleted account');
    });

    it('names the address of a failed sign-in', () => {
        expect(
            auditActionLabel(
                event('sign_in_failed', {
                    actor: null,
                    subject: null,
                    properties: { email: 'malik@atlas.fr' },
                }),
                t,
            ),
        ).toBe('failed sign-in as malik@atlas.fr');
    });
});
