/** The message of a refused field, under it. Nothing when the field is valid. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
    if (message === undefined) {
        return null;
    }

    return (
        <p id={id} role="alert" className="text-xs text-skrum-destructive-text">
            {message}
        </p>
    );
}
