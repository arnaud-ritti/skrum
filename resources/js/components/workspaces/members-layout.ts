/**
 * Under 36rem of card, a row is a block: the person on a first line, the
 * role and the actions on a second one; an invitation takes three lines, its
 * state and its two buttons being wider than a phone. The table keeps its
 * markup.
 */
export const MembersLayout = {
    table: '@max-xl/card:block',
    header: '@max-xl/card:hidden',
    body: '@max-xl/card:block',
    row: '@max-xl/card:grid @max-xl/card:grid-cols-[minmax(0,1fr)_auto] @max-xl/card:items-center @max-xl/card:gap-x-3 @max-xl/card:gap-y-2 @max-xl/card:px-5 @max-xl/card:py-3',
    person: 'w-full max-w-0 px-5 py-1.5 @max-xl/card:col-span-2 @max-xl/card:block @max-xl/card:max-w-none @max-xl/card:p-0',
    cell: 'px-5 py-1.5 @max-xl/card:block @max-xl/card:min-w-0 @max-xl/card:p-0',
    actions:
        'px-5 py-1.5 text-right whitespace-nowrap @max-xl/card:block @max-xl/card:p-0',
    wideCell:
        'px-5 py-1.5 @max-xl/card:col-span-2 @max-xl/card:block @max-xl/card:min-w-0 @max-xl/card:p-0',
    wideActions:
        'px-5 py-1.5 text-right whitespace-nowrap @max-xl/card:col-span-2 @max-xl/card:block @max-xl/card:p-0 @max-xl/card:text-left',
} as const;
