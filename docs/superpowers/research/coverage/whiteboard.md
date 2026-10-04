# Coverage: whiteboard, its templates and its guest board

Date: 2026-10-04. Branch `tests/coverage-whiteboard`. Specs: `docs/superpowers/specs/2026-10-01-whiteboard-design.md` (plan 17) and `docs/superpowers/specs/2026-10-21-whiteboard-toolbars-design.md` (roadmap plan 20, the only roadmap spec of plans 20 to 29 with whiteboard criteria; plan 23 adds the observer view, P23-04).

New browser file: `tests/Browser/Walkthroughs/CoverageWhiteboardTest.php` (CVW-01 to CVW-06). New feature case: `WhiteboardElementDeltaTest` "gives the changes to an observer and a guest of the board, and refuses…". The other files are:

- `Plan17aWhiteboardCoreTest.php` (P17a), `Plan17bWhiteboardTemplatesTest.php` (P17b), `Plan17cWhiteboardFacilitationTest.php` (P17c), `Plan17dWhiteboardSecrecyTest.php` (P17d)
- `Plan18eWhiteboardTest.php` (P18e-07), `Roadmap20WhiteboardToolbarsTest.php` (R20)
- `WhiteboardVisualTest.php` (P18e-07-02 to 05, P20-18: eight configurations each, light and dark, English and French, 1440 and 390, with the overflow check)
- `Smoke/WhiteboardHarnessTest.php`
- the templates page: `Plan18eWorkspaceTest.php` (P18e-09-11), `WorkspacePagesVisualTest.php`, `TeamWorkspaceDataVisualTest.php`

## Routes

| Route | Kind | Renders for the right person | Refused for the wrong person |
| --- | --- | --- | --- |
| `GET whiteboards/{board}` (`whiteboards.show`) | page | facilitator P17a-01, P18e-07-02, 09; member P17a-08a, R20-09; guest P17a-02a; workspace admin outside the team CVW-06; observer CVW-03 (read mode, "You are observing this session.", no tools, writes 403); captures P18e-07-05, P20-18 | workspace member outside the team P17a-06b (403); another workspace CVW-02 (403); visitor CVW-01 (login, or session-ended with guests on); replaced guest link P17a-07a, 07b; guests turned off P17a-06a |
| `GET whiteboards/join/{guestToken}` (`whiteboards.join.show`) | page | P18e-07-01, P17a-02a and every guest join; capture P18e-07-02 | unknown link P18e-07-01, P18e-07-03; guests turned off CVW-04, P17a-06a; replaced link P17a-07a; a team member and a returning guest are sent to the board CVW-04 |
| `GET w/{workspace}/templates` (`workspaces.templates.index`), Whiteboard tab | page | P18e-09-11, CVW-05; captures `WorkspacePagesVisualTest`, `TeamWorkspaceDataVisualTest` | another workspace CVW-05 (403); visitor CVW-05 (login); guest P17b-18 (401 on the template requests) |
| `GET whiteboards/{board}/snapshot` | JSON | feature `WhiteboardSnapshotTest`, `WhiteboardAccessTest`; browser P17a-01 | feature `WhiteboardAccessTest` (403, 401, wrong secret), `WhiteboardRoleBoundariesTest` (admin of another workspace); browser P17a-06b, CVW-02 |
| `GET whiteboards/{board}/elements` | JSON | feature `WhiteboardElementDeltaTest` (member, observer, guest); browser P17a-05a, P17b-29 | feature `WhiteboardElementDeltaTest` (outsider 403, visitor 401, purge 409); browser CVW-02 |
| `GET whiteboards/{board}/files/{fileId}` | asset | feature `WhiteboardFilesTest`; browser P17a-02c, P17b-10, P17b-15 | feature `WhiteboardFilesTest` (outside the board, another board's file, malformed id) |

**Phone, dark theme and English.** The board, its menu and dialogs, its toolbars and the join pages are captured in the eight configurations by `WhiteboardVisualTest`. R20-14 and P18e-07-08 cover the phone, R20-17 and P17b-07 the dark theme, R20-18 and P17b-05 the language. No new screen was added by this pass.

## Mockups

Method: each `preview.html` rendered at 1440 with `app.css` (its `@theme` blocks read as `:root`), `_preview-bundle.css`, the local Figtree, Bricolage and JetBrains Mono fonts and the Lucide icons, light and dark (the class `dark` on the root; ExcalidrawTheme draws its own dark frames). Compared with `WhiteboardVisualTest` (light and dark 1440 French, light 390 French) and the `/dev/design-system/template-editor` and `whiteboard-theme` benches. Captures kept outside the repository.

| Mockup | Status | Notes |
| --- | --- | --- |
| ScreenWhiteboard | fixed; open | **Fixed:** the colour swatches of the selection bar are 1.25rem with a 1.5px edge and a foreground ring when chosen (`wb-swatch`); they were 1.5rem with a primary ring. **Matches:** tool bar order, letters and separators, history, zoom bar, minimap, count chip, selection bar order, dark theme. **Open:** dot grid (reported); the minimap above the zoom bar (P20-11, waits for the owner); stickies are drawn with square corners (`roundness: null` in `sticky-tool.tsx` and the templates) where `sk-sticky` is rounded: new, a change of stored element data, left to the owner; the swatch pitch is 2.25rem (2rem targets) against 1.625rem drawn, kept for the touch target. Header extras and the absent comments, "Convert to actions" and author lines are approved rows (18e, P20-01). |
| WhiteboardToolbar | matches; open | Ten tools, keys and "More tools" as approved (P20-03, P20-05, P20-12). **Open:** the two mockups disagree on the chosen colour of the sticky sub-bar (WhiteboardToolbar: the tool's soft fill and primary edge; ScreenWhiteboard: a ring); the app uses one colour bar, drawn as ScreenWhiteboard. |
| ExcalidrawTheme | fixed; open | **Fixed (app bug):** in the Styles panel every option had the accent background and the chosen one no edge, so all looked chosen; the options now sit on `--muted` and the chosen one has the primary soft fill and a primary edge, in both themes (`excalidraw-theme.css`, Vitest). **Matches:** quick picks hidden as the README allows, island colours, tool active state, selection frame. **Open:** the library's option buttons are 2rem squares with the large radius, not 2rem × 1.75rem with the small one; the hint line is not shown (P20-08, approved). |
| MobileRituals (whiteboard frame) | matches; open | "Reading" pill and the dock with "Fit to screen" and "Edit" as approved (P20-07). **Open:** the phone header has the logo, the online chip, Share, the menu and the facilitation row, where the frame has a back arrow, "Whiteboard · 5 online" under the title and the presence stack; fit to screen on open (reported). The survey and icebreaker frames belong to their own lanes. |
| TemplateEditor | fixed; open | **Fixed:** the live preview tints each column in its colour with a square swatch, the help question (a dash without one) and coloured placeholder cards; the footer's error summary has its alert icon, Duplicate its copy icon, Cancel is ghost and Save has a check icon. **Open, already ruled:** no description, default settings or "edited by" line (plan 23 non-goals); a category select and ten columns instead of eight (app rules). |

## Acceptance criteria (plan 20, spec §13)

| # | Criterion (short) | Test |
| --- | --- | --- |
| 1 | Library chrome hidden; our bars in the mockup's places | R20-01, P20-18 |
| 2 | Ten tools in order with keys; library-chosen tool shown | R20-02 |
| 3 | Sticky tool: press adds, back to Selection, colour adds in the middle, reaches another browser | R20-03, Smoke |
| 4 | Shape and Connector sub-bars; last choice kept | R20-04 |
| 5 | Undo and Redo, disabled with the library's | R20-05 |
| 6 | Zoom steps, limits, reset, Fit | R20-06 |
| 7 | Minimap: elements in colour, view, press centres, live, remembered | R20-07 |
| 8 | Selection bar placement and count chip; hidden while dragging | R20-08, P20-18 |
| 9 | Colours recolour filled shapes; absent without a fill | R20-08, P18e-07-07 |
| 10 | Group, align, distribute, delete | R20-08 |
| 11 | Lock for the facilitator only; locked selection disabled with the reason | R20-09 |
| 12 | Styles shows the property panel beside the tool bar | R20-10, P20-18 (styles) |
| 13 | The former hamburger's entries in the board menu | R20-11 (find, clear, background), P17b-19 (save as image), P17a-09 (canvas help) |
| 14 | Locked board or read mode: only zoom and minimap | R20-12, P18e-07-08, CVW-03 (observer) |
| 15 | Follower who zooms or uses the minimap is paused; Resume | R20-13, P17c-04a |
| 16 | Phone read dock and compact bar with its drawer | R20-14, P20-18 (390) |
| 17 | One tab stop per bar, arrows, Home, End, names and pressed state | R20-02, R20-15 |
| 18 | N, C, M; never in a field; single-key preference | R20-15 |
| 19 | Shortcuts dialog lists the board's keys | R20-16 |
| 20 | Older boards open unchanged, sticky swatch selected | Vitest (fixture); visible in P20-18 (styles) |
| 21 | No dependency; front gates | gates |
| 22 | Keys in four languages, informal | `TranslationKeysTest`, `InformalRegisterTest`; R20-18 |
| 23 | Captures match the mockups apart from approved rows | this pass (table above) |
| 24 | PHP and Vitest suites | suites (not browser) |
