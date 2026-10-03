import { useSyncExternalStore } from 'react';
import {
    onlineSnapshot,
    subscribeOnline,
} from '@/lib/realtime/workspace-presence';

const nobody: ReadonlySet<string> = new Set();

/** The user ids that have a signed-in page of the current workspace open. */
export function useOnlineUserIds(): ReadonlySet<string> {
    return useSyncExternalStore(subscribeOnline, onlineSnapshot, () => nobody);
}
