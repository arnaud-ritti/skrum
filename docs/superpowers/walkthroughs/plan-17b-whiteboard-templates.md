# Plan 17b — whiteboard templates: walkthrough

Not replayed yet: every line is unticked until the Chrome walkthrough runs. Tick a line when it was observed; leave it unticked with the reason when it was not replayed.

## Before starting

Run `vendor/bin/sail artisan migrate --no-interaction` and `npm run build`. Accounts and origins are those of `.superpowers/sdd/whiteboard-rules.md`:

- Member A: `http://localhost`, logged in as "Fran Facilitator" (`facilitator@skrum.test`, password constant of `database/seeders/DemoSeeder.php`). Team page: Demo Workspace → Demo Team.
- Second member: `member@skrum.test`, logged in on `http://127.0.0.1` (separate cookie jar, same Chrome).
- Guest B: on `http://127.0.0.1` when no member is logged in there. Enable guest access on the board, read the token with `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select guest_token from whiteboards where id='<board id>'"`, open `http://127.0.0.1/whiteboards/join/<token>`.

Only one account per origin: sections 2 and 3 both use `127.0.0.1`, so finish one before starting the other. Never trigger a native dialog; when a canvas input cannot be driven after two attempts, check the same thing through the board's JSON endpoints and say so on the line.

## 1. Each of the eight built-in templates creates a board whose structure is locked and whose texts are in the creator's language

Setup: member A on the team page, UI in English first, then French.

- [ ] B7.1 — Action: press "New whiteboard". Expected: a dialog with eight tiles (Blank, Brainstorm, Flowchart, User story map, Impact map, SWOT, Lean canvas, 2×2 matrix), Blank first and selected, each with a thumbnail, a name and a description; skeletons show while the gallery loads; once a workspace template exists (section 2) it appears under "Workspace templates".
- [ ] Action: create one board per built-in template (eight boards), UI in English. Expected: each creation lands on the new board with A as facilitator, and the board shows the template's structure.
- [ ] B7.2 — Action: on each of those boards, click-drag a frame, a legend or an axis, then select it and press Delete; then do the same with a sample sticky note. Expected: frames, legend and axes cannot be selected-and-moved or deleted; sample notes can be moved and deleted.
- [ ] Action: for each board, `fetch` `GET /whiteboards/<id>/snapshot`. Expected: every element of type `frame` has `locked: true`; sample sticky notes have `locked: false`.
- [ ] B7.2 — Action: switch the UI to French, then German, and create a Flowchart and an Impact map in each. Expected: every label sits inside its shape without clipping.
- [ ] B7.3 — Action: with the UI in French, create a SWOT board. Expected: the four quadrants read "Forces / Faiblesses / Opportunités / Menaces", and no English text remains on the board.
- [ ] Action: with the UI in French, open the "New whiteboard" dialog. Expected: tile names and descriptions are in French.
- [ ] B7.6 — Action: resize the window to 375 px wide and open the dialog. Expected: tiles and the form are usable, with no horizontal scroll of the page and a reachable "Create" button.
- [ ] B7.6 — Action: switch to the dark theme and open the dialog. Expected: every thumbnail sits on a white surface and shows its structure: Lean canvas shows nine outlined frames, Flowchart its shapes, arrows and legend, and a workspace template made of default-stroke shapes is not blank.

## 2. A board saved as a workspace template gives another member a board with the same elements and images, no votes and no author data, independent afterwards

Setup: member A on a board holding a sticky note, a shape, an arrow bound to the shape and an image. Second member logged in on `http://127.0.0.1`.

- [ ] B8.3 — Action: A opens the board menu, "Save as template", enters a name and a description, saves. Expected: a success toast "Template saved.", the dialog closes, and the template appears in the team page gallery under "Workspace templates" with a thumbnail.
- [ ] B8.3 — Action: A saves the same board again under the same name, then under the same name in another case with surrounding spaces. Expected: the dialog stays open with "A template with this name already exists." under the name field; no second template is created.
- [ ] Action: the second member opens "New whiteboard", picks the workspace template and creates a board. Expected: the new board shows the same sticky note, shape, arrow (still bound to the shape: moving the shape moves the arrow end) and image.
- [ ] B8.5 — Expected: the image of the source board is displayed on the board created from the template (not a broken-image placeholder), and on a duplicate of the source (section 5).
- [ ] Action: `docker exec skrum-pgsql-1 psql -U sail -d skrum -At -c "select distinct author_member_id from whiteboard_elements where whiteboard_id = '<new>'"`. Expected: a single value, the member id of the new board's facilitator (the second member); none of A's ids.
- [ ] Action: compare element ids of the source and the new board (`select id from whiteboard_elements where whiteboard_id in ('<source>', '<new>')`). Expected: no id is shared; every element of the new board has version 1.
- [ ] Action: A edits the source board (moves the sticky, deletes the shape); the second member edits the new board. Expected: neither board shows the other's edits, after a reload too.
- [ ] B7.4 — Action: A opens the templates dialog on the team page, renames the template and edits its description. Expected: the gallery shows the new name and description; the board already created from it is unchanged.
- [ ] B7.4 — Action: A renames the template to the name of another template. Expected: the error shows under the name field and the name is unchanged.
- [ ] B7.4 — Action: the second member (not the creator, not an admin) opens the templates dialog. Expected: no Edit and no Delete on A's template.
- [ ] B7.4 — Action: a workspace admin who is not the creator opens the templates dialog. Expected: Edit and Delete are offered and work.
- [ ] Action: A deletes the template ("Delete this template?" → confirm), then deletes the source board. Expected: the template leaves the gallery; the board created from it still opens with all its elements and its image.

## 3. A guest cannot list, use or save workspace templates

Setup: guest B on `http://127.0.0.1`, joined through the guest link of one of A's boards (log the second member out of that origin first).

- [ ] B8.1 — Action: member A opens the board menu. Expected: "Duplicate this board" and "Save as template" are listed.
- [ ] B8.1 — Action: guest B opens the board menu. Expected: neither entry is shown.
- [ ] Action: from B's page, `fetch` `POST /whiteboards/<id>/template` with a JSON body `{"name": "x"}` and the XSRF header. Expected: 403 "Guests cannot do this."; no row added to `whiteboard_templates`.
- [ ] Action: from B's page, `fetch` `POST /whiteboards/<id>/duplicate` with the XSRF header. Expected: 403 "Guests cannot do this."; no board added.
- [ ] Action: B opens the team URL (`http://127.0.0.1/w/<workspace>/teams/<team>`, copied from A's address bar). Expected: redirect to the login page; no gallery, no template name shown.
- [ ] Action: from B's page, `fetch` `PATCH` and `DELETE` on `/w/<workspace>/whiteboard-templates/<template id>`. Expected: neither succeeds (redirect to login or 401/403); the template is unchanged.

## 4. A member exports PNG, SVG and `.excalidraw` from the board

Setup: member A on a board titled with a recognisable name, holding a few elements and an image.

- [ ] B8.4 — Action: canvas menu → "Save as image", choose PNG, then SVG. Expected: both formats are offered and each downloaded file name starts with the board title.
- [ ] B8.4 — Action: canvas menu → "Export", save to disk. Expected: a `.excalidraw` file named after the board title.
- [ ] B8.5 — Expected: the image placed on the board is present in the PNG export.
- [ ] B8.4 — Expected: no library name or link appears in skrum's own UI while exporting (the documented exceptions of spec §13 aside).

## 5. Duplicate and delete from the list

Setup: member A on a board with elements and an image; the second member on `http://127.0.0.1`.

- [ ] B8.2 — Action: A uses board menu → "Duplicate this board". Expected: A lands on a board titled "<title> (copy)" with the same elements and image, A as facilitator, default settings (guest access off).
- [ ] B8.2 — Action: the second member duplicates one of A's boards. Expected: the second member is facilitator of the copy; the source keeps A as facilitator and nobody on the source sees a notice.
- [ ] B8.2 — Action: edit the copy, reload the original. Expected: the original is unchanged.
- [ ] Action: with the UI in French, duplicate a board. Expected: the title ends with " (copie)".
- [ ] B7.5 — Action: on the team page, look at the whiteboard list as A, then as the second member. Expected: the trash button shows on a row only for that board's facilitator and for workspace admins.
- [ ] B7.5 — Action: A presses the trash button and confirms "Delete this board?". Expected: the row disappears without a full page reload.
- [ ] B7.5 — Action: keep a second tab open on that board while deleting it. Expected: the open tab shows "This board was deleted".

## 6. Sync follow-up

Setup: member A on a board with a few elements, with a second browser (guest or second member) on the same board to cause remote changes.

- [ ] B1.1 — Action: `docker exec skrum-pgsql-1 psql -U sail -d skrum -c "update whiteboards set purged_seq = seq where id = '<id>'"`, then make A's page fetch a delta (block and unblock the board's requests, or make a remote change). Expected: the scene stays intact, `GET snapshot` is requested, and the "Reconnecting…" banner disappears.
- [ ] B1.2 — Action: same, with `GET snapshot` failing first (block the URL from the page, then unblock). Expected: the banner stays, a retry happens after about 2 s then about 4 s, and the banner clears on success.

## Feature tests that pin these criteria

- `tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php` — eight templates, locked structure, texts in the creator's locale, labels fitting their shape in the four locales.
- `tests/Feature/Whiteboards/CopyWhiteboardSceneTest.php` — fresh ids, indices and versions, remapped references, dangling references dropped, images left out when the stored file is gone or its copy fails.
- `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php` — save as template, name uniqueness, the cap of 50, manage rights, guests refused, independence from the source, pruning of template files.
- `tests/Feature/Whiteboards/WhiteboardDuplicateTest.php` — duplicate: title, facilitator, default settings, source untouched, guests refused.
- `tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php` — team page props: gallery, templates, delete rights.
- `tests/Feature/Whiteboards/PresentWhiteboardPreviewTest.php` — the text-free outline behind the thumbnails.

Not in this plan: private writing does not exist yet. "Blocked while private writing is on" for duplicate and save-as-template, and "a masked note exports masked", arrive with plan 17d together with their walkthrough lines.
