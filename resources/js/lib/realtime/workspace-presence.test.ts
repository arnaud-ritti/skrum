import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    followWorkspace,
    onlineSnapshot,
    onlineWorkspaceId,
    subscribeOnline,
} from './workspace-presence';

type Member = { id: string };
type Handlers = {
    here?: (members: Member[]) => void;
    joining?: (member: Member) => void;
    leaving?: (member: Member) => void;
};

const joined: Record<string, Handlers> = {};
const joins: string[] = [];
const leaves: string[] = [];
let configured = true;

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => configured,
    echo: () => ({
        join: (name: string) => {
            const handlers: Handlers = {};
            const channel = {
                here: (callback: Handlers['here']) => {
                    handlers.here = callback;

                    return channel;
                },
                joining: (callback: Handlers['joining']) => {
                    handlers.joining = callback;

                    return channel;
                },
                leaving: (callback: Handlers['leaving']) => {
                    handlers.leaving = callback;

                    return channel;
                },
            };

            joined[name] = handlers;
            joins.push(name);

            return channel;
        },
        leave: (name: string) => leaves.push(name),
    }),
}));

beforeEach(() => {
    configured = true;
    followWorkspace(null);
    joins.length = 0;
    leaves.length = 0;
});

describe('workspace presence', () => {
    it('joins the workspace channel and follows who is here, joins and leaves', () => {
        followWorkspace('w1');
        joined['workspace-online.w1'].here?.([{ id: 'a' }, { id: 'b' }]);
        joined['workspace-online.w1'].joining?.({ id: 'c' });
        joined['workspace-online.w1'].leaving?.({ id: 'a' });

        expect(joins).toEqual(['workspace-online.w1']);
        expect([...onlineSnapshot()].sort()).toEqual(['b', 'c']);
    });

    it('does nothing when the workspace does not change', () => {
        followWorkspace('w1');
        followWorkspace('w1');

        expect(joins).toEqual(['workspace-online.w1']);
        expect(leaves).toEqual([]);
    });

    it('leaves the old channel and forgets its people when the workspace changes', () => {
        followWorkspace('w1');
        joined['workspace-online.w1'].here?.([{ id: 'a' }]);
        followWorkspace('w2');

        expect(leaves).toEqual(['workspace-online.w1']);
        expect(joins).toEqual(['workspace-online.w1', 'workspace-online.w2']);
        expect(onlineSnapshot().size).toBe(0);
    });

    it('joins nothing without Echo', () => {
        configured = false;
        followWorkspace('w1');

        expect(joins).toEqual([]);
        expect(onlineSnapshot().size).toBe(0);
    });

    it('tells its subscribers when the set changes', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeOnline(listener);

        followWorkspace('w1');
        joined['workspace-online.w1'].joining?.({ id: 'a' });
        unsubscribe();
        joined['workspace-online.w1'].joining?.({ id: 'b' });

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('follows the current workspace of a signed-in user only', () => {
        expect(
            onlineWorkspaceId({
                auth: { user: { id: 'u' } },
                currentWorkspace: { id: 'w' },
            }),
        ).toBe('w');
        expect(
            onlineWorkspaceId({
                auth: { user: null },
                currentWorkspace: { id: 'w' },
            }),
        ).toBeNull();
        expect(
            onlineWorkspaceId({
                auth: { user: { id: 'u' } },
                currentWorkspace: null,
            }),
        ).toBeNull();
        expect(onlineWorkspaceId({})).toBeNull();
    });
});
