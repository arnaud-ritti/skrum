Bulle flottante ancrée à un déclencheur : `Popover` (contenu interactif, ex. réactions, réglage du timer) et `Tooltip` (libellé non interactif).

**Quand l'utiliser**
- Popover : petit contenu interactif lié à un élément (choisir une réaction, +1 min au timer, filtre rapide).
- Tooltip : nommer un bouton icône, révéler un raccourci clavier, préciser un statut de présence.
- Mobile : Popover → `Drawer` ; les tooltips ne s'affichent pas au toucher (le libellé doit exister ailleurs).

**Anatomie**
Popover : `--popover`, bord `--border`, `--radius`, `--shadow-popover`, padding 16 (8 pour la grille d'emoji 6×36 px), décalage 4–6 px du déclencheur qui reste en état actif. Tooltip : fond `--foreground`, texte `--background`, 12/500, padding 6×10, `--radius-sm`, flèche 8 px, `sk-kbd` transparent pour les raccourcis.

**Props**
```ts
interface ReactionPickerProps { trigger: React.ReactNode; emojis: string[]; mine: string[]; onToggle: (emoji: string) => void; side?: 'top' | 'bottom'; align?: 'start' | 'center' | 'end' }
interface TooltipProps { content: string; shortcut?: string[]; side?: 'top' | 'right' | 'bottom' | 'left'; delayDuration?: number /* 400 ms */; children: React.ReactElement }
```

**États**
Popover ouvert (déclencheur avec anneau `--ring`), emoji déjà choisi (`--skrum-primary-soft` + contour `--primary`), emoji survolé (`--accent`). Tooltip : haut (défaut), bas, avec raccourci ; apparition `--duration-fast`.

**Accessibilité & clavier**
- Popover : déclencheur `aria-expanded` + `aria-controls`, focus déplacé dans le contenu, `Esc` ferme et rend le focus ; flèches pour parcourir la grille d'emoji.
- Tooltip : `role="tooltip"` lié par `aria-describedby`, affiché au focus clavier comme au survol ; jamais de lien ni bouton dedans.
- Raccourci exposé aussi via `aria-keyshortcuts`.

**Temps réel**
Les compteurs de réactions de la carte se mettent à jour pendant que le popover est ouvert ; le popover ne se referme pas sur un update distant.

**À faire / À éviter**
- Faire : tooltip ≤ 1 ligne ; popover ≤ 320 px de large.
- Éviter : tooltip sur un élément désactivé sans wrapper focusable ; informations critiques uniquement dans un tooltip.

**Tokens**
`--popover` `--popover-foreground` `--border` `--foreground` `--background` `--accent` `--skrum-primary-soft` `--primary` `--ring` `--shadow-popover` `--radius` `--radius-sm` `--radius-md` `--duration-fast` `--duration-base` `--ease-enter`

**Mapping shadcn**
- `@/components/ui/popover`, `@/components/ui/tooltip` (+ `TooltipProvider delayDuration={400}` à la racine).
- PopoverContent : `w-auto rounded-lg border bg-popover p-4 shadow-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95` ; picker `p-2 grid grid-cols-6 gap-1`.
- TooltipContent : `rounded-sm bg-foreground px-2.5 py-1.5 text-xs font-medium text-background` + `TooltipArrow className="fill-foreground"` ; kbd : `border-background/35 bg-transparent text-inherit`.
