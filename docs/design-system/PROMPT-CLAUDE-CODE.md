Tu implémentes le design system de **Skrüm** (SaaS + self-hostable : rétros, planning poker, whiteboard, icebreakers, sondages) dans ce repo Laravel 12 + Inertia v2 + React 19 + TypeScript + shadcn/ui (new-york) + Tailwind CSS v4 + lucide-react. Temps réel : Laravel Reverb / Echo.

## Source de vérité : `docs/design-system/`

- `README.md` : brand book et règles d'usage. Lis-le EN ENTIER avant toute chose.
- `sections/01-directions.md`, `02-motion.md`, `03-iconographie.md`, `04-tailwind.md`, `05-white-label.md`.
- `tokens.json` : tous les tokens (couleurs light/dark en OKLCH, typo, spacing, radius, shadow, duration, ease, zIndex, layout), chacun avec une note d'usage.
- `app.css` : le `resources/css/app.css` final. Il est déjà validé : compile avec Tailwind 4.3, contrastes WCAG vérifiés.
- `php/BrandPalette.php` : dérivation white-label avec garde-fous de contraste. Testée.
- `logos/*.svg` : logo horizontal, symbole, mot-symbole, favicon, en variantes clair, sombre et mono.
- `components/<Nom>/README.md` : spec de chaque composant (props TS, états, clavier, temps réel, tokens, mapping shadcn).
- `components/<Nom>/preview.html` : maquette statique de référence visuelle. Les classes `sk-*` et `_preview-bundle.css` servent UNIQUEMENT au rendu des previews : **ne les porte jamais dans l'app**. Traduis-les en classes Tailwind sur les composants shadcn.
- Les dossiers `components/Screen*` et `Mobile*` sont les maquettes d'écrans : desktop 1440 et mobile 390.

## Règles non négociables

0. Unités : **rem** pour toute taille, px seulement pour les traits ≤ 2px et le rayon pill. **Tailwind d'abord** : si la valeur existe dans l'échelle Tailwind, utilise la classe Tailwind (`p-3`, `h-5.5`, `text-sm/snug`, `rounded-lg`). Sinon, ajoute-la au thème dans `app.css` (`@theme`) puis utilise la classe générée. Jamais de valeur arbitraire `[…]` pour une taille. La correspondance est dans `sections/04-tailwind.md`.
9. Pas de débordement : chaque composant doit tenir à partir de 20rem de conteneur (container queries `@container`), et un libellé de Select, d'item de menu ou de bouton ne passe jamais à la ligne (`truncate`).

1. Aucune couleur en dur (hex, rgb, `white`, `black`, palette Tailwind par défaut comme `bg-red-500`). Utilise uniquement les tokens : `bg-primary text-primary-foreground`, `bg-skrum-col-sun`, `text-skrum-success-text`, `bg-skrum-presence-3 text-skrum-presence-3-foreground`… Texte sur un fond plein = son `*-foreground`.
2. Contrastes : chaque token de texte n'est utilisé que sur les fonds cités dans sa note de `tokens.json`. Focus clavier : `outline-2 outline-ring outline-offset-2`, jamais supprimé.
3. Icônes : lucide-react uniquement, mapping dans `sections/03-iconographie.md`.
4. Motion : durées et easings de `sections/02-motion.md`. `prefers-reduced-motion` doit être respecté partout. Pas de confettis en mode réduit.
5. Emoji seulement là où c'est une fonctionnalité : réactions, jeu d'emoji, carte ☕.
6. i18n FR/EN dès le départ, via le mécanisme existant du repo (sinon propose-en un). Libellés ~30 % plus longs en FR : pas de largeur fixe sur un libellé.
7. Destructive = toujours icône + libellé (le terracotta est proche du rouge).
8. Les composants restent présentationnels (props typées). Temps réel et Inertia sont branchés dans des hooks et conteneurs séparés.

## Partir de l'existant
L'app a déjà : workspaces, page équipe, rétro (phases Writing → Grouping → Voting → Discussing → Completed), poker (file de tâches, Watch only, rounds, historique, decks), whiteboard Excalidraw, games, health check, réactions, settings utilisateur. Restyle et complète ces écrans (maquettes `ScreenTeam`, `ScreenPokerQueue` — salle de poker en modèle « table » uniquement —, `ScreenWorkspace`, `ScreenUserSettings`, en EN et FR), ne les réécris pas. Les phases de rétro cibles sont Icebreaker → Writing → Grouping → Voting → Discussing → Actions → ROTI : ajoute Actions et ROTI. La ReactionBar ne doit jamais chevaucher le deck du poker. Un seul modèle de sidebar (voir `components/Sidebar/README.md`) et un seul modèle de salle de poker (la table ovale).

## Méthode

- Commence par explorer le repo : structure `resources/js`, `components.json`, composants shadcn déjà installés, i18n, tests (Pest, Vitest), lint et Prettier, gestion du dark mode, Reverb. Puis donne-moi un **plan par phases** et attends ma validation avant de coder.
- Une phase = une branche et un commit propre, avec vérifications vertes : `npm run build`, `npx tsc --noEmit`, lint, `php artisan test`.
- Si une dépendance nouvelle n'est pas listée ici, demande-moi avant de l'ajouter.
- Ne modifie pas les valeurs de `app.css` ni de `tokens.json`. Si un token manque, dis-le-moi et propose-le.

## Phases

**Phase 1 — Fondations**
- Remplace `resources/css/app.css` par `docs/design-system/app.css`.
- `npm i tw-animate-css @fontsource-variable/figtree @fontsource-variable/bricolage-grotesque @fontsource-variable/jetbrains-mono`
- `components.json` : `style: new-york`, `tailwind.css: resources/css/app.css`, `cssVariables: true`, `iconLibrary: lucide`.
- Dark mode par classe `.dark` sur `<html>`, avec les préférences système / clair / sombre persistées. Pas de flash au chargement : applique un script inline dans `app.blade.php`.
- Logos dans `public/brand/`, favicon SVG, et un composant `<SkrumLogo variant="horizontal|symbol|wordmark" />`. Préfère le SVG inline avec `fill` sur les tokens (`fill-primary`, `fill-foreground`) pour qu'il suive le thème.
- Route **locale uniquement** `/dev/design-system` (page Inertia, désactivée hors `local`). Elle affiche la palette complète (tous les tokens en clair et en sombre), l'échelle typo, les rayons, les ombres et les durées. Elle sert de banc d'essai pour la suite.

**Phase 2 — shadcn thémés**
- Installe et vérifie : Button, Input, Textarea, Select, Combobox (Popover + Command), Dialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, Command, Tabs, Badge, Avatar, Card, Table, Sonner, Progress, Slider, Switch, Checkbox, RadioGroup, Skeleton, Sidebar, Breadcrumb, Chart, Calendar/DatePicker, Accordion/Collapsible, Pagination, ToggleGroup, InputOTP.
- Pour chacun, applique les écarts décrits dans `components/<Nom>/README.md`, section « Mapping shadcn ». Exemples : variantes de Badge `soft/success/warning/info/destructive`, tailles d'Avatar, hover `color-mix`, focus ring.
- Ajoute chaque composant, avec tous ses états, à `/dev/design-system`.

**Phase 3 — Composants métier** (`resources/js/components/skrum/`)
- Liste : RetroCard, RetroColumn, CardGroup, VoteDots, PhaseStepper, FacilitatorBar, Timer, PresenceStack, ConnectionState, LiveCursor, ActionItem, PokerCard, PokerTable, WhiteboardToolbar, SurveyQuestion, IcebreakerGameCard, ROTIWidget, MoodTrendChart, GuestJoin, EmptyState, ReactionBar, HealthCheck, GamesLeaderboard, GifPicker (Giphy via un proxy Laravel, clé configurable et désactivable par l'admin), NotificationsPanel. Le whiteboard reste sur Excalidraw : applique `components/ExcalidrawTheme/README.md` (surcharge des variables CSS + palette des 8 post-its), ne recode pas la toolbar.
- Props et états exactement comme dans les README, rendu conforme aux `preview.html`, en clair et en sombre.
- Couleur de colonne via les utilitaires `col-<nom>` et `bg-(--col)`. Présence via un helper `presenceColor(index)` sur 1 à 12.
- Clavier complet (voir chaque README). Retournement de PokerCard en 3D (`flip-3d`, `backface-hidden`), avec un fondu en mode réduit.
- Tests Vitest + Testing Library pour la logique d'état : masquage, votes restants, états du Timer, calculs moyenne / médiane / consensus du poker.

**Phase 4 — White-label self-host**
- `app/Support/Branding/BrandPalette.php` à partir de `php/BrandPalette.php`.
- Réglages d'instance : couleur, logo clair et sombre, favicon, rayon 0–16, nom affiché, « Propulsé par Skrüm ». Stockage en migration et modèle, CSS généré mis en cache.
- `<style id="skrum-brand">` injecté après `@vite` dans `app.blade.php`.
- Page Admin › Branding conforme à la maquette `components/ScreenSettings`. Elle comprend :
  - un aperçu live en clair et en sombre ;
  - l'affichage des ratios de contraste ;
  - les avertissements renvoyés par `BrandPalette`.
- Tests Pest sur une liste de couleurs : `#FFD600`, `#22c55e`, `#777777`, `#0a0a0a`, `#e11d48`, `#2B63B0`. Vérifie dans les deux thèmes : `primary-foreground`/`primary` ≥ 4.5 et `primary`/`background` ≥ 3.

**Phase 5 — Écrans** (liste complète dans `README.md` › Composants › Écrans : création de session, 7 phases de rétro avec fin de session, poker « table », 4 icebreakers dont « Le sprint en un GIF », onboarding et invitation, erreurs, sécurité et 2FA ; e-mails en Mailables d'après `components/Emails/README.md`) (un commit par écran, en données mockées d'abord)
Ordre :
1. Board rétro, en 3 phases : `ScreenRetroWriting`, `ScreenRetroVote`, `ScreenRetroActions`.
2. Planning poker : `ScreenPokerBefore`, `ScreenPokerAfter`.
3. `ScreenDashboard`.
4. `ScreenActions`.
5. `ScreenAuth`, avec `GuestJoin`.
6. `ScreenSurvey`.
7. `ScreenIcebreaker`.
8. `ScreenWhiteboard`.
9. `ScreenSettings`.
10. `ScreenLanding`.

Chaque écran doit fonctionner en responsive, avec la version mobile décrite dans `components/Mobile*` : colonnes en onglets swipables, Drawer à la place de Popover et Sheet, cibles de 44 px, FacilitatorBar compacte.

## Vérification visuelle (à chaque phase)
Écris un test Playwright qui capture `/dev/design-system` et chaque écran en clair et en sombre, en 1440 et en 390. Compare-les toi-même aux `preview.html`. Mets les captures dans `tests/visual/__screenshots__/`.

À la fin de chaque phase, envoie-moi un rapport court :
- ce qui est fait ;
- les écarts avec les maquettes et leurs raisons ;
- les tokens ou composants qui manquent ;
- la suite.
