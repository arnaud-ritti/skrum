# Plan 17b — whiteboard templates: walkthrough

Run on 2026-10-01 in Chrome against the local Sail stack, at commit cfb4e4d (branch `feat/plan-17bcd-whiteboard`), after `sail artisan migrate` (nothing to migrate) and `npm run build`. Member A = Fran Facilitator on `http://localhost`; guest B = "Guest Gia" on `http://127.0.0.1`. Ticked lines were observed; unticked lines carry the reason.

## Result

No defect found on the lines that were replayed. Sections 1, 3, 4 and 6 were replayed in full (section 4 without writing files, see there). Sections 2 and 5 were replayed for member A only.

Not replayed, and why:

- **Every line that needs a second logged-in account** (second member `member@skrum.test`, admin `admin@skrum.test`): `http://127.0.0.1` had no session and the walkthrough agent does not type passwords without the user asking for it in chat. Concerned: section 2 (board created *by another member*, Edit/Delete hidden for a non-creator, admin edits and deletes), section 5 (duplicate by the second member, trash button per account). The copy path itself was replayed with A creating the board from her own template.
- **Board deletion** (section 2 last line, section 5 B7.5 delete and "This board was deleted"): the click on the trash button was refused by the agent's permission system (irreversible deletion). No board was deleted.
- **Real file downloads** (section 4): the save picker is a native dialog, so `showSaveFilePicker` was replaced on the page by a stub that records the suggested name and aborts. Formats and names were observed; no file was written, and the PNG content was seen in the export preview only.

Observations outside the criteria (not counted as defects of this plan):

- **A board created from a template opens with the scene origin in the top-left corner of the canvas.** The top row sits under the top bar and the shapes toolbar, and the names of the top frames are above the visible area until the user pans: "Forces" and "Faiblesses" on the French SWOT, "Goal / Actors / Impacts / Deliverables" on the Impact map, "Activities" on the User story map, "Légende" on the Flowchart, whose "Start" node is half hidden by the toolbar. The names are in the snapshot and show after panning.
- In French and German at a 929 px high viewport the "New whiteboard" dialog is taller than the window: "Create" is partly below the fold and reached by scrolling the dialog.
- The "Save to…" dialog keeps the library's sentence "Export the scene data to a file from which you can import later", while "Open" is removed from the menu.

Console: no error on any board page, except the two `whiteboard: the board was not reloaded` lines logged on purpose by the client while the snapshot URL was blocked for B1.2.

Regression of the 17a basics on the new board "Walkthrough 17b":

- [x] Created from the team page (Blank), landed on it as facilitator, listed on the team page.
- [x] Rectangle, sticky note, arrow bound to the rectangle and an image (dropped as a file on the canvas, no file picker) drawn by A; guest B, joined through the guest link, saw them, and an ellipse drawn afterwards by A was on B at the next check.
- [x] Reload of A keeps the scene with no write-back: 0 `PUT elements`, seq 6 before and after.
- [x] Reactions bar present bottom-centre for A and B.
- [x] No library name in the page text and no outbound link, on the board, in the export dialogs and in the canvas menu.

Left in the database by this run: boards "Walkthrough 17b", "W17b Brainstorm", "W17b Flowchart", "W17b User story map", "W17b Impact map", "W17b SWOT", "W17b Lean canvas", "W17b Matrix", "W17b SWOT FR", "W17b Logigramme FR", "W17b Impact FR", "W17b Impact FR (copie)", "W17b Flussdiagramm DE", "W17b Impact DE", "W17b From template", "W17b From template (copy)", and the workspace template "W17b Second". Fran's UI language was switched to French and German (`PUT /locale`, the endpoint behind the language switcher) and set back to English. `purged_seq` was set to `seq` twice on "W17b From template" (section 6).

## Before starting

Run `vendor/bin/sail artisan migrate --no-interaction` and `npm run build`. Accounts and origins are those of `.superpowers/sdd/whiteboard-rules.md`:

- Member A: `http://localhost`, logged in as "Fran Facilitator" (`facilitator@skrum.test`, password constant of `database/seeders/DemoSeeder.php`). Team page: Demo Workspace → Demo Team.
- Second member: `member@skrum.test`, logged in on `http://127.0.0.1` (separate cookie jar, same Chrome).
- Workspace admin: `admin@skrum.test` ("Ada Admin", same password), owner of Demo Workspace and neither the creator of A's templates nor the facilitator of A's boards. She is not a member of Demo Team, but a workspace owner can open the team page (`TeamPolicy::view` through `canManage`). She logs in on `http://127.0.0.1` after the second member is logged out there: once for the admin line of section 2, once for the trash-button line of section 5; log her out before the second member or a guest uses that origin again.
- Guest B: on `http://127.0.0.1` when no member is logged in there. Enable guest access on the board, read the token with `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select guest_token from whiteboards where id='<board id>'"`, open `http://127.0.0.1/whiteboards/join/<token>`.

Only one account per origin: the second member, the admin and guest B all use `127.0.0.1`, so finish with one before logging in the next, and finish section 2 before starting section 3. Never trigger a native dialog; when a canvas input cannot be driven after two attempts, check the same thing through the board's JSON endpoints and say so on the line.

## 1. Each of the eight built-in templates creates a board whose structure is locked and whose texts are in the creator's language

Setup: member A on the team page, UI in English first, then French.

- [x] B7.1 — Action: press "New whiteboard". Expected: a dialog with eight tiles (Blank, Brainstorm, Flowchart, User story map, Impact map, SWOT, Lean canvas, 2×2 matrix), Blank first and selected, each with a thumbnail, a name and a description; skeletons show while the gallery loads; once a workspace template exists (section 2) it appears under "Workspace templates". — eight tiles, Blank first and selected; 6 skeleton nodes counted by a MutationObserver while the gallery loaded; "W17b Template" listed under "Workspace templates" after section 2
- [x] Action: create one board per built-in template (eight boards), UI in English. Expected: each creation lands on the new board with A as facilitator, and the board shows the template's structure. — eight boards, `me.isFacilitator` true on each; see the observation in "Result" about the top row sitting under the toolbar
- [x] B7.2 — Action: on each of those boards, click-drag a frame, a legend or an axis, then select it and press Delete; then do the same with a sample sticky note. Expected: frames, legend and axes cannot be selected-and-moved or deleted; sample notes can be moved and deleted. — on the seven boards with a structure: drag by the border, click on the border or the name then Delete left seq and the element count unchanged (frames; legend frame and legend shape of the Flowchart; "Impact" axis of the matrix). Sample notes were moved and deleted on Brainstorm, User story map, Impact map, SWOT and Lean canvas; a sample shape was moved (its arrow followed) and another deleted on the Flowchart; the matrix note was moved, its deletion was not driven. Blank has no structure.
- [x] Action: for each board, `fetch` `GET /whiteboards/<id>/snapshot`. Expected: every element of type `frame` has `locked: true`; sample sticky notes have `locked: false`. — Brainstorm 3 frames, User story map 3, Impact map 4, SWOT 4, Lean canvas 9, matrix 4 frames + 2 axes + 2 axis labels, Flowchart 1 frame + 3 legend shapes + 3 legend labels: all locked; every sticky and sample shape unlocked
- [x] B7.2 — Action: switch the UI to French, then German, and create a Flowchart and an Impact map in each. Expected: every label sits inside its shape without clipping. — seen on screen, and in the snapshot every bound text box lies inside its container (FR: widest "Pourquoi faisons-nous cela ?" 183 px in 200; DE: "Wie soll sich ihr Verhalten ändern?" 164 px in 200, "Nächster Schritt" 154 px in 200)
- [x] B7.3 — Action: with the UI in French, create a SWOT board. Expected: the four quadrants read "Forces / Faiblesses / Opportunités / Menaces", and no English text remains on the board. — frame names Forces, Faiblesses, Opportunités, Menaces and four French notes in the snapshot; "Opportunités" and "Menaces" read on screen, the two top names are above the visible area at opening (observation in "Result")
- [x] Action: with the UI in French, open the "New whiteboard" dialog. Expected: tile names and descriptions are in French. — Vierge, Brainstorming, Logigramme, Carte des récits utilisateur, Carte d'impact, SWOT, Lean canvas, Matrice 2×2, with French descriptions; German tiles seen too
- [x] B7.6 — Action: resize the window to 375 px wide and open the dialog. Expected: tiles and the form are usable, with no horizontal scroll of the page and a reachable "Create" button. — the window could not be made narrower by the browser tools, so the team page was loaded in a 375 px wide same-origin iframe (371 px of content): document scroll width 371, dialog 322 px wide with two columns of tiles and its own vertical scroll, "Create" inside the dialog's scroll area
- [x] B7.6 — Action: switch to the dark theme and open the dialog. Expected: every thumbnail sits on a white surface and shows its structure: Lean canvas shows nine outlined frames, Flowchart its shapes, arrows and legend, and a workspace template made of default-stroke shapes is not blank. — the whole run was in the dark theme; the workspace template thumbnail shows its rectangle, arrow, ellipse and sticky

## 2. A board saved as a workspace template gives another member a board with the same elements and images, no votes and no author data, independent afterwards

Setup: member A on a board holding a sticky note, a shape, an arrow bound to the shape and an image. Second member logged in on `http://127.0.0.1`.

- [x] B8.3 — Action: A opens the board menu, "Save as template", enters a name and a description, saves. Expected: a success toast "Template saved.", the dialog closes, and the template appears in the team page gallery under "Workspace templates" with a thumbnail.
- [x] B8.3 — Action: A saves the same board again under the same name, then under the same name in another case with surrounding spaces. Expected: the dialog stays open with "A template with this name already exists." under the name field; no second template is created. — "W17b Template" then "  w17B TEMPLATE  ": error under the field both times, one row in `whiteboard_templates`
- [ ] Action: the second member opens "New whiteboard", picks the workspace template and creates a board. Expected: the new board shows the same sticky note, shape, arrow (still bound to the shape: moving the shape moves the arrow end) and image. — NOT replayed with the second member (no second login, see "Result"). Replayed with A creating the board: same five elements and the image; moving the rectangle moved the arrow end.
- [x] B8.5 — Expected: the image of the source board is displayed on the board created from the template (not a broken-image placeholder), and on a duplicate of the source (section 5). — image drawn on both; `GET files/<fileId>` on the new board answers 200 `image/png`, and each board has its own `whiteboard_files` row
- [ ] Action: `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select distinct author_member_id from whiteboard_elements where whiteboard_id = '<new>'"`. Expected: a single value, the member id of the new board's facilitator (the second member); none of A's ids. — NOT replayed with the second member. With A as creator: a single value, the facilitator member of the new board, different from A's member id on the source board; the stored template scene contains no author and no vote key.
- [x] Action: compare the canvas element ids of the source and the new board: `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select whiteboard_id, element_id, version from whiteboard_elements where whiteboard_id in ('<source>', '<new>') and not is_deleted"`. Expected: no `element_id` appears under both boards; every row of the new board has version 1. — no shared id; all version 1 in the snapshot taken right after creation (two rows were at 2 in psql because the rectangle had been moved by then)
- [x] Action: A edits the source board (moves the sticky, deletes the shape); the second member edits the new board. Expected: neither board shows the other's edits, after a reload too. — both edits made by A: sticky moved and ellipse deleted on the source, rectangle moved on the new board; each snapshot and each reloaded page shows only its own edits
- [x] B7.4 — Action: A opens the templates dialog on the team page, renames the template and edits its description. Expected: the gallery shows the new name and description; the board already created from it is unchanged. — "W17b Renamed" / "Edited description" in the dialog and in the database; board title and elements unchanged
- [x] B7.4 — Action: A renames the template to the name of another template. Expected: the error shows under the name field and the name is unchanged. — "w17b second" against "W17b Second"
- [ ] B7.4 — Action: the second member (not the creator, not an admin) opens the templates dialog. Expected: no Edit and no Delete on A's template. — NOT replayed (no second login); covered by `WhiteboardTemplatesTest` and `TeamWhiteboardsSectionTest`
- [ ] B7.4 — Action: log the second member out of `http://127.0.0.1`, log in there as the admin (`admin@skrum.test`), open Demo Team and the templates dialog, edit the description of A's template, then delete a second template saved by A for this line. Expected: Edit and Delete are offered to the admin on A's templates and both work. Log the admin out afterwards. — NOT replayed (no admin login); the second template "W17b Second" was saved for this line and is still there
- [ ] Action: A deletes the template ("Delete this template?" → confirm), then deletes the source board. Expected: the template leaves the gallery; the board created from it still opens with all its elements and its image. — template part observed: inline confirmation, the template left the dialog and the table, the board created from it still opens with its five elements and its image. The deletion of the source board was NOT replayed (refused by the agent's permission system).

## 3. A guest cannot list, use or save workspace templates

Setup: guest B on `http://127.0.0.1`, joined through the guest link of one of A's boards (log the second member out of that origin first).

- [x] B8.1 — Action: member A opens the board menu. Expected: "Duplicate this board" and "Save as template" are listed.
- [x] B8.1 — Action: guest B opens the board menu. Expected: neither entry is shown. — a single entry, "Masquer mon curseur" (the guest's browser is in French)
- [x] Action: from B's page, `fetch` `POST /whiteboards/<id>/template` with a JSON body `{"name": "x"}` and the XSRF header. Expected: 403 "Guests cannot do this."; no row added to `whiteboard_templates`. — 403 "Les invités ne peuvent pas faire cela."
- [x] Action: from B's page, `fetch` `POST /whiteboards/<id>/duplicate` with the XSRF header. Expected: 403 "Guests cannot do this."; no board added. — 403, same message
- [x] Action: B opens the team URL (`http://127.0.0.1/w/<workspace>/teams/<team>`, copied from A's address bar). Expected: redirect to the login page; no gallery, no template name shown.
- [x] Action: from B's page, `fetch` `PATCH` and `DELETE` on `/w/<workspace>/whiteboard-templates/<template id>`. Expected: neither succeeds (redirect to login or 401/403); the template is unchanged. — 401 and 401; also `POST /w/<workspace>/teams/<team>/whiteboards` with the template id: 401; template and board counts unchanged

## 4. A member exports PNG, SVG and `.excalidraw` from the board

Setup: member A on a board titled with a recognisable name, holding a few elements and an image.

The menu entries are labelled "Export image…" and "Save to…". No file was written: `window.showSaveFilePicker` was replaced by a stub that records the suggested name and aborts, because the real picker is a native dialog.

- [x] B8.4 — Action: canvas menu → "Save as image", choose PNG, then SVG. Expected: both formats are offered and each downloaded file name starts with the board title. — PNG, SVG and "Copy to clipboard" offered; suggested names "W17b From template.png" and "W17b From template.svg"
- [x] B8.4 — Action: canvas menu → "Export", save to disk. Expected: a `.excalidraw` file named after the board title. — suggested name "W17b From template.excalidraw"
- [ ] B8.5 — Expected: the image placed on the board is present in the PNG export. — NOT checked in an exported file (none was written); the image is in the preview of the export dialog
- [x] B8.4 — Expected: no library name or link appears in skrum's own UI while exporting (the documented exceptions of spec §13 aside). — no library name in the text of either dialog, no link; the `.excalidraw` extension and its file type are the documented exceptions

## 5. Duplicate and delete from the list

Setup: member A on a board with elements and an image; the second member on `http://127.0.0.1`.

- [x] B8.2 — Action: A uses board menu → "Duplicate this board". Expected: A lands on a board titled "<title> (copy)" with the same elements and image, A as facilitator, default settings (guest access off). — "W17b From template (copy)", five elements at the same positions, all version 1, image drawn, guest access off, cursors and reactions on
- [ ] B8.2 — Action: the second member duplicates one of A's boards. Expected: the second member is facilitator of the copy; the source keeps A as facilitator and nobody on the source sees a notice. — NOT replayed (no second login); covered by `WhiteboardDuplicateTest`
- [x] B8.2 — Action: edit the copy, reload the original. Expected: the original is unchanged. — ellipse deleted on the copy; original still at seq 7 with its five elements after a reload
- [x] Action: with the UI in French, duplicate a board. Expected: the title ends with " (copie)". — "W17b Impact FR (copie)", arrows still bound to the copied notes
- [ ] B7.5 — Action: on the team page, look at the whiteboard list as A, then as the second member, then as the admin (`admin@skrum.test`, logged in on `http://127.0.0.1` after the second member is logged out). Expected: A and the second member each see the trash button only on the rows of the boards they facilitate; the admin, who facilitates none, sees it on every row. — only A's view was observed: a trash button on every row, and A facilitates every board listed. Second member and admin NOT replayed (no login).
- [ ] B7.5 — Action: A presses the trash button and confirms "Delete this board?". Expected: the row disappears without a full page reload. — NOT replayed (refused by the agent's permission system)
- [ ] B7.5 — Action: keep a second tab open on that board while deleting it. Expected: the open tab shows "This board was deleted". — NOT replayed (same reason)

## 6. Sync follow-up

Setup: member A on a board with a few elements, with a second browser (guest or second member) on the same board to cause remote changes.

Remote changes were made with `fetch` `PUT elements` from A's page instead of a second browser: one carrying A's socket id (so A receives no event and stays one seq behind), then, after the `update`, one without it (so A receives an event she cannot apply and fetches a delta). Requests were logged by wrapping `XMLHttpRequest.open` on the page.

- [x] B1.1 — Action: take A's tab off the board (block the board's requests from the page, or send the change below with A's socket id so that A receives no event), change the board from a second client so that `seq` moves past what A holds, then `docker exec skrum-pgsql-1 psql -U sail -d skrum -c "update whiteboards set purged_seq = seq where id = '<id>'"`, then bring A back (unblock, or make one more remote change that A does receive). A now asks for a delta with `since` below `purged_seq`, which is what answers 409; setting `purged_seq = seq` while A is up to date gives `since == purged_seq` and an ordinary delta. Expected: `GET elements?since=<A's seq>` answers 409, the scene stays intact, `GET snapshot` is requested, and the "Reconnecting…" banner disappears. — `GET elements?since=7` then `GET snapshot` 50 ms later; scene intact with the remote move applied; the banner never appeared
- [x] B1.2 — Action: same setup as B1.1 (A behind `purged_seq`), with `GET snapshot` failing first (block the URL from the page, then unblock). Expected: the banner stays, a retry happens after about 2 s then about 4 s, and the banner clears on success. — `GET snapshot` failed at 0 s (banner shown), again at +2.4 s, succeeded at +7.4 s (5.0 s after the second failure, timers of a background tab); the banner cleared 70 ms later

## Feature tests that pin these criteria

- `tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php` — eight templates, locked structure, texts in the creator's locale, labels fitting their shape in the four locales.
- `tests/Feature/Whiteboards/CopyWhiteboardSceneTest.php` — fresh ids, indices and versions, remapped references, dangling references dropped, images left out when the stored file is gone or its copy fails.
- `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php` — save as template, name uniqueness, the cap of 50, manage rights, guests refused, independence from the source, pruning of template files.
- `tests/Feature/Whiteboards/WhiteboardDuplicateTest.php` — duplicate: title, facilitator, default settings, source untouched, guests refused.
- `tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php` — team page props: gallery, templates, delete rights.
- `tests/Feature/Whiteboards/PresentWhiteboardPreviewTest.php` — the text-free outline behind the thumbnails.

Not in this plan: private writing does not exist yet. "Blocked while private writing is on" for duplicate and save-as-template, and "a masked note exports masked", arrive with plan 17d together with their walkthrough lines.
