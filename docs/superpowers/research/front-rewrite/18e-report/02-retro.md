# Group 2 — Retro

## Task R1 — Eight column colours (B10)

### Parity (brief 02 §7.4)

| Row | Change | Done |
|---|---|---|
| `ColumnColor` (PHP) | eight cases: `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss` | yes |
| Migration (up only) | `2026_10_15_100300_map_column_colors_to_the_eight_theme_colors`: `columns` and `workspace_template_columns`, green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris | yes |
| Built-in catalogue | the 52 templates use the new values, same mapping | yes |
| Column, workspace-template and retro-creation endpoints | no code change (`Rule::enum`); the six old values answer 422 on `color` / `columns.*.color` | yes |
| Factories | `ColumnColor::Moss` | yes |
| Front type | one union, `ColumnColor` of `lib/retro/types.ts`, re-exported by `skrum/column-color-picker.tsx`; `ServerColumnColor`, `DesignColumnColor`, `AnyColumnColor`, `serverColumnColors` are gone | yes |
| Colour list | `columnColors` and `ColumnColorOptions` of `skrum/column-color-picker.tsx` are the only list; `lib/retro/colors.ts` is deleted | yes |
| Add a column on the board | `ColumnColorOptions` in the form (radios named Sun … Moss), default Moss | yes |
| Recolour a column on the board | the eight `menuitemradio` of the column menu, named Sun … Moss | yes |
| Workspace templates page | the colour select lists the eight colours | yes |
| Language files | "Amber" and "Slate" removed (unused); "Green", "Red", "Blue", "Purple" stay: the whiteboard sticky tool and the drawing toolbar still use them | yes |

### Places left

None: R1 changes data and a colour list, not a layout.

### Differences with the mockup

None found on the bench captures (`design-system-retro-column`, `-retro-card`, `-template-editor`, `-card-group`, `-retro-template-picker`, `session-create`). The captures of `card-group` and `retro-template-picker` are byte-identical to the ones before the change, which shows the old values were already drawn with the colours they are now mapped to. The add-column form and the column menu of the board are the old board components until R3 and R4 replace them; they are not compared with a mockup here.

## Task R2 — Guest join and session ended

### Parity (brief 02 §3.6 rows 99–101; brief 11 §3 rows 32, 35–39)

| Row | Feature | Now | Done |
|---|---|---|---|
| 02-99, 11-32 | Join as guest: nickname, max 50, prefilled with the signed-in user's name, POST `join/{guestToken}` | `GuestJoinPage kind="retro"` → `GuestJoin`; `#name`, button "Join", `router.post(RetroJoinsController.store.url(token))` | yes |
| 11-35 | Server error under the nickname | `errors.name` of the page props → `error` of `GuestJoin` | yes |
| 11-36 | Button disabled while the request runs | `processing` of `GuestJoinPage` | yes |
| 02-100, 11-37 | Invalid link, HTTP 404: "Join a retrospective", "This guest link is no longer valid." | `AccessNotice` (through `GuestJoinPage` with `session={null}`) | yes |
| 11-38 | Head title: the retro title, or "Join a retrospective" | `<Head>` in the page | yes |
| 02-101, 11-39 | Session ended: "Your session has ended.", "Guests: ask the facilitator for the guest link.", "Log in" → `login()` | `AccessNotice` with `hint` and a full-width `Button asChild` `Link`; shared by the four session types | yes |
| M28 | Facilitator, people present, state | the `session` prop of R2a (B45) | yes |

### Places left

- Guest colour picker (GU-1) and short session code (GU-2), deviation D-32: both regions are inside `skrum/guest-join.tsx` (`takenColors` / `initialPresence` and `session.code`). `GuestJoinPage` does not pass them today, so nothing is drawn; the later feature passes them and nothing else moves.

### Differences with the mockup

Captures `retro-join-*`, `retro-join-invalid-*`, `retro-session-ended-*` against `components/GuestJoin/preview.html` and `components/MobileAccess`.

| Difference | Covered by |
|---|---|
| No colour picker, no coloured avatar preview (a neutral outline avatar), no session code | D-32 |
| No random nickname ("Loutre pensive"), no "random name" button, and no line "Suggested nickname if you leave it empty" under the preview (it would be false: nothing is suggested; `GuestJoin` now shows it only with `defaultName`). An empty nickname is refused by the server and the error shows under the field | D-32 (GU-1 brings the guest identity); row 11-32 |
| The logo is drawn twice: in the header of the centred `AuthFrame` (with the language switcher) and in the card, as the mockup's card has it | no row — reported; `AuthFrame` and `GuestJoin` are Task 0.7 / 18c components |
| At 390 the action is `sticky` inside the card and sits above the privacy line; the mockup of `MobileAccess` glues it to the bottom of the screen. When the card is shorter than the screen the two look the same but for the order | no row — reported; `GuestJoin stickyAction` is an 18c component |
| The invalid link and the ended session have no mockup: designed from neighbours (`AccessNotice`, brief 11 line 14) | — |
