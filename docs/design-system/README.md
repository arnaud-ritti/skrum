Skrüm est l'outil des rituels agiles — rétro, planning poker, whiteboard, icebreakers, sondages — en SaaS ou auto-hébergé. Sérieux sur le fond, chaleureux et ludique sur la forme : une base neutre et calme où **le contenu de l'équipe est la star**, une couleur terracotta affirmée pour l'action, et des post-its vifs mais harmonisés. Promesse : **« Les réunions se terminent, les actions restent. »**

Direction retenue : **Terracotta & Sauge** (la direction alternative « Encre & Post-it » est décrite dans la section *Directions de marque*). Stack cible : Laravel 12 + Inertia v2 + React 19 + TypeScript, shadcn/ui `new-york`, Tailwind CSS v4, lucide-react. Le fichier `resources/css/app.css` complet est dans la section *Tailwind v4 — app.css*.

## Utiliser ce système

- Couleurs = tokens sémantiques shadcn (`background`, `foreground`, `card`, `primary`…) + tokens `skrum-*`. Deux thèmes, `light` (défaut) et `dark` (classe `.dark` dans l'app). Ne peins jamais une couleur en dur : en Tailwind, `bg-primary text-primary-foreground`, `bg-skrum-col-sun`, `text-skrum-success-text`.
- Chaque token de texte indique dans sa note les fonds sur lesquels il est lisible ; toutes ces paires sont vérifiées dans les deux thèmes (script de contraste). Texte courant `foreground` : **AAA (≥ 7:1)**. Texte secondaire `muted-foreground` et textes colorés `*-text` : **AA (≥ 4.5:1)**. Contrôles (`input`), focus (`ring`) et `primary` sur fond : **≥ 3:1**.
- Texte sur une couleur pleine = son `*-foreground`, jamais `white`. En sombre, `primary` s'éclaircit et `primary-foreground` devient encre foncée.
- **Unités : rem** (base 16px) pour toute taille — texte, espacements, rayons, largeurs, seuils de container queries. px uniquement pour les traits ≤ 2px (bordures, outlines, offsets de focus) et le rayon pill `9999px`.
- **Tailwind d'abord** : une valeur qui existe dans l'échelle Tailwind s'écrit avec la classe Tailwind (`p-3`, `text-sm/snug`, `h-14`, `rounded-lg`) ; une valeur hors échelle est ajoutée au thème (`text-body-sm`, `w-column`, `@card-wide/card:`). Jamais de valeur arbitraire `[…]` pour une taille. Table de correspondance : section *Tailwind v4 — app.css*.
- Previews : classes `sk-*` de `components/bundle.css` (miroir statique des composants shadcn thémés). Icônes `<i data-lucide="nom">` rendues par `components/bundle.js` (`window.Skrum.renderIcons()`).

## Voix & contenu

- **Vouvoiement collectif, impératif court.** « Ajoutez une carte », « Révéler les votes », « Rejoindre en tant qu'invité ». Dans le board, verbes à l'infinitif sur les boutons (« Voter », « Révéler », « Phase suivante »).
- Parler **de l'équipe**, pas de l'outil : « Qu'est-ce qui a bien marché ? » plutôt que « Créer un élément de rétrospective ».
- Ton chaleureux, jamais infantilisant : pas de points d'exclamation en série, pas de « Oups ! ». Les erreurs disent quoi faire : « Connexion perdue — vos cartes sont gardées, on se reconnecte… ».
- Emoji : **uniquement** comme fonctionnalité (réactions, jeu « Devine l'emoji », carte ☕ du poker). Jamais décoratifs dans l'UI.
- Casse : phrase (« Nouvelle rétro », pas « Nouvelle Rétro »). Nom de marque : **Skrüm** dans les phrases, `skrüm` en minuscules dans le logo. Le « ü » ne se remplace jamais par « u » (sauf slug technique `skrum`).
- Sécurité psychologique visible : « Anonyme », « Masquée jusqu'à la révélation », « Votes masqués » sont des libellés explicites, jamais de simples icônes.
- i18n FR/EN : les libellés FR sont ~30 % plus longs — boutons en `whitespace-nowrap` avec largeur libre, jamais de largeur fixe sur un libellé ; colonnes de board min 280 px.

## Fondations visuelles

**Couleur.** Neutres chauds (teinte 55–80, chroma ≤ 0.016) pour que les post-its ressortent. `primary` terracotta (`oklch(0.56 0.15 38)`) = action principale, état actif, focus, phase courante ; une seule action primaire par zone. `secondary` sauge = actions secondaires calmes, table de poker. `accent` = survol d'items de menu. `destructive` = suppression et erreurs bloquantes ; comme sa teinte est voisine du terracotta, **il est toujours accompagné d'une icône (`Trash2`, `CircleAlert`) ou d'un mot**. États : `skrum-success` (teal, s'écarte de l'axe rouge-vert), `skrum-warning` (ambre, texte foncé dessus), `skrum-info` (bleu). Chaque état existe en plein (`skrum-success` + `-foreground`) et en doux (`-soft` + `-text`).

**Colonnes / post-its — 8 couleurs** : `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss`. Chacune a un fond (`skrum-col-X`), une bordure (`-border`) et un texte (`-text`) ; le contenu d'une carte reste en `foreground` (AAA sur les 8 fonds, dans les 2 thèmes). Ordre par défaut d'un board : Bien passé = `moss`, À améliorer = `coral`, Idées = `sun`, Remerciements = `plum`, puis `sky`, `lagoon`, `iris`, `apricot`. Une couleur de colonne ne porte jamais de sens d'état.

**Présence — 12 couleurs** (`skrum-presence-1…12` + `-foreground`) pour avatars, curseurs live et anneaux « en train d'écrire ». Optimisées pour rester distinctes en deutéranopie, protanopie et tritanopie (écart OKLab minimal ≈ 0.09). La couleur n'identifie jamais seule une personne : initiales sur l'avatar, nom sur le curseur. Attribution : ordre d'arrivée dans la session, l'invité choisit la sienne dans `GuestJoin`. Les curseurs clairs (3, 6, 8) ont un liseré `card` pour rester visibles sur fond clair.

**ROTI 1→5** : `skrum-roti-1` (corail) → `skrum-roti-5` (teal), luminosité croissante, chiffre toujours affiché en `skrum-roti-foreground`. **Graphiques** : `chart-1` terracotta, `chart-2` sauge, `chart-3` bleu, `chart-4` soleil (jamais de texte blanc dessus), `chart-5` prune — dans cet ordre.

**Typographie.** `Figtree` pour toute l'UI (bonne lisibilité en 12–14 px, chaleureuse sans être ronde), `Bricolage Grotesque` pour les titres display, valeurs de poker et marketing (le caractère de la marque), `JetBrains Mono` pour IDs de tickets, codes de session, timers et clés. Styles (rem, taille/interligne) et classes Tailwind : `display-2xl` 3.75/4 → `text-6xl/16`, `display-xl` 2.75/3 → `text-display-xl`, `display-lg` 2.125/2.5 → `text-display-lg`, `heading-xl` 1.5/2 → `text-2xl`, `heading-lg` 1.25/1.75 → `text-xl`, `heading-md` 1/1.5 → `text-base`, `body-lg` 1/1.625 → `text-base/relaxed`, `body` 0.875/1.375 → `text-sm/snug` (défaut, contenu des cartes), `body-sm` 0.8125/1.25 → `text-body-sm`, `caption` 0.75/1 → `text-xs` (plancher absolu), `overline` 0.6875/1 → `text-overline`, `mono` 0.8125/1.25, `timer` 1.75/2 → `text-stat`. Chiffres tabulaires (`tabular-nums`) pour timers, votes, compteurs. En self-host, les polices sont servies par `@fontsource-variable/*` (aucune requête Google).

**Espacement.** Grille 0.25rem = `--spacing` de Tailwind v4 (`space-1` = 0.25rem = `p-1` … `space-24` = 6rem = `p-24` ; `space-3` = `p-3` = 0.75rem). Carte : padding `space-3`, gap entre cartes `space-3`, colonnes espacées de `space-6`. Page : gutter `space-10` desktop, `space-4` mobile.

**Rayons.** Base shadcn `--radius` = 0.625rem ; dérivés Tailwind `rounded-sm` 0.375rem, `rounded-md` 0.5rem (inputs, boutons), `rounded-lg` = `radius` 0.625rem (cartes, popovers), `rounded-xl` 0.875rem (dialogs, colonnes, PokerCard), `rounded-2xl` 1.25rem (drawer), `rounded-full` (avatars, VoteDots, pastilles). Un admin white-label ne change que `--radius` (0–16 px).

**Élévation.** surface (aucune ombre, `background`/`skrum-canvas`) → `shadow-card` (cartes au repos) → `shadow-raised` (hover, barres flottantes) → `shadow-popover` (menus, toasts) → `shadow-modal` (dialog, sheet, drawer) → `shadow-drag` (carte saisie : `rotate(-2deg) scale(1.03)`). En sombre les ombres s'accompagnent d'un anneau `#ffffff0f–1f` et d'une surface plus claire (`card` < `popover`).

**Bordures & focus.** `border` pour les filets décoratifs, `input` (≥ 3:1) pour tout contour de contrôle. Focus clavier : anneau **2 px plein `ring` décalé de 2 px**, jamais supprimé, jamais seulement une ombre floue.

**Fond de board.** `skrum-canvas` (un cran sous `background`), trame de points `skrum-canvas-dot` pour le whiteboard. Chrome minimal : sidebar repliée en icônes (`sidebar-width-icon` 48 px) pendant une session, barres flottantes (`PhaseStepper`, `FacilitatorBar`, `WhiteboardToolbar`) en `popover` + `shadow-raised`.

**Mouvement** — voir la section *Motion*. Tout respecte `prefers-reduced-motion`.

## Le « ü » comme motif

Le tréma = deux points = deux personnes qui se font face, ou deux votes. Il apparaît : dans le logo (points terracotta + sauge sur le mot-symbole) ; comme **loader** `sk-trema` (deux points qui rebondissent en alternance : connexion, « Inès écrit… ») ; dans les indicateurs de présence et les VoteDots (pastilles rondes). Ne pas l'utiliser en décoration gratuite (fonds à pois, puces de liste).

## Logo

Fichiers dans le groupe **Logos** : `skrum-logo-horizontal-{light,dark}.svg` (symbole + mot-symbole), `skrum-symbol-{light,dark}.svg` (tuile post-it à coin replié portant un ü), `skrum-wordmark-{light,dark,mono}.svg`, `skrum-favicon.svg` (32 px, tuile simplifiée). Zone de protection = hauteur d'un point du tréma × 2 autour du logo. Taille mini : symbole 16 px (favicon), horizontal 96 px de large. Ne pas recolorer les points hors des couleurs de marque, ne pas mettre le symbole sur un fond terracotta (utiliser le mot-symbole mono). En white-label, le logo de l'instance remplace le symbole dans la sidebar et l'écran d'auth ; « Propulsé par Skrüm » reste dans le pied de page (désactivable par l'admin).

## Composants

- **shadcn thémés** (groupes « shadcn · … ») : Button, Input/Textarea, Select/Combobox, Checkbox/Radio/Switch, Slider/Progress, Dialog, Sheet, Drawer, Popover/Tooltip, DropdownMenu, Command (⌘K), Tabs, Breadcrumb, Sidebar, Badge, Avatar, Card, Table, Skeleton, Sonner (+ Alert), Chart, DatePicker / Calendar, Accordion / Collapsible, Pagination, ToggleGroup, InputOTP. Chaque README donne le mapping `@/components/ui/*` et les classes Tailwind.
- **Métier Skrüm** : RetroCard, RetroColumn, CardGroup, VoteDots, PhaseStepper, FacilitatorBar, Timer, PresenceStack, ConnectionState, LiveCursor, ActionItem, PokerCard, PokerTable, WhiteboardToolbar, SurveyQuestion, IcebreakerGameCard, ROTIWidget, MoodTrendChart, GuestJoin, EmptyState, **ReactionBar** (barre de réactions flottante commune rétro / poker / whiteboard), **ExcalidrawTheme** (le whiteboard est Excalidraw : on le thème, on ne le recode pas), **HealthCheck** (énoncés intégrés + custom, réponse, résultats), **GamesLeaderboard** (rooms + classement), **GifPicker** (GIF via Giphy, proxy Laravel, attribution « Powered by GIPHY »), **NotificationsPanel** (cloche), **AvatarStylePicker** (style d'avatar DiceBear choisi dans le Branding), **SessionTypePicker**, **RetroTemplatePicker**, **TemplateEditor** (avec ColumnColorPicker), **DeckPicker** (decks intégrés, sauvegardés, éditeur), **ShareDialog** (lien, QR, code, rôles), **KeyboardShortcuts** (`?`), **SessionSettingsPopover** (réglages en cours de session, « Add survey »), **Emails** (modèles transactionnels).
- **Écrans** : 29 maquettes desktop 1440 et 5 planches mobiles 390 (15 écrans). Accès : landing, auth, onboarding et invitation, erreurs. Équipe : dashboard, page équipe, workspace et templates, actions, paramètres équipe et admin d'instance, paramètres utilisateur, sécurité et 2FA. Rétro : création de session, puis les 7 phases (Écriture, Regroupement, Vote, Discussion, Actions, ROTI et fin de session). Poker : salle « table » avant et après révélation, Watch only, file, rounds, historique et decks. Rituels : whiteboard, sondage, icebreakers (pendu, dessin à deviner, devine l'emoji, le sprint en un GIF). Les écrans ajoutés après la première série sont en EN + FR.

## Principes UX

- **Phases de rétro (référence produit)** : Icebreaker → Écriture → Regroupement → Vote → Discussion → Actions → ROTI (EN : Icebreaker → Writing → Grouping → Voting → Discussing → Actions → ROTI). L'app actuelle s'arrête à Completed après Discussing : elle doit ajouter Actions et ROTI comme phases à part entière.
- **Réactions** : la `ReactionBar` ne chevauche jamais un autre panneau ; sur le poker elle se pose au-dessus du deck avec un écart `space-3`.

- Le board est plein écran ; le contenu passe avant le chrome. Une seule barre de facilitation, flottante, en bas.
- Tout se fait au clavier (raccourcis affichés dans les tooltips et menus, palette ⌘K) et au tactile (cibles ≥ 44 px sur mobile, `Drawer` à la place de `Popover`/`Sheet`, colonnes en onglets swipables).
- Temps réel explicite mais discret : `ConnectionState` en pastille dans la topbar, verrou « Inès écrit » sur la carte, curseurs masquables. Jamais de modale bloquante pour une reconnexion.
- Anonymat et révélation : les cartes des autres sont masquées en phase Écriture, les totaux de votes masqués jusqu'à la révélation — et c'est **écrit**, pas seulement suggéré.
- Chaque rituel finit sur quelque chose de concret : actions assignées (ActionItem), estimation retenue, décision — c'est ce que le dashboard remonte ensuite.
