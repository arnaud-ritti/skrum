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
