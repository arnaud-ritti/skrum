const nobody: ReadonlySet<string> = new Set();

/**
 * The user ids that have a signed-in page of the current workspace open.
 * Nobody until the workspace presence channel is joined (Task 28 of plan 23).
 */
export function useOnlineUserIds(): ReadonlySet<string> {
    return nobody;
}
