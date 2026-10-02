/**
 * A full load of the document, not an Inertia visit: of `returnTo` when the
 * current URL only answers another method than GET, of the current URL otherwise.
 */
export function reloadDocument(returnTo?: string | null): void {
    if (returnTo) {
        window.location.assign(returnTo);

        return;
    }

    window.location.reload();
}
