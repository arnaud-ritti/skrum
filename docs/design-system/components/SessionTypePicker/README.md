Choix du type de session (Rétro, Planning poker, Whiteboard, Sondage, Icebreaker) en tuiles radio, avec une variante liste compacte pour le menu « Nouvelle session » et le Drawer mobile.

## Quand l'utiliser
- En tête du dialog « Nouvelle session » (ScreenSessionCreate) : tuiles, une seule sélection, le reste du dialog dépend du type.
- Variante `compact` : menu déroulant du bouton « Nouvelle session » (dashboard, sidebar, page Sessions) et Drawer plein écran sur mobile.
- Pas pour filtrer une liste de sessions (utiliser `ToggleGroup` / `Tabs`).

## Anatomie
Tuile `ss-type` : carré de type `ss-kind` (couleur de colonne via `sk-c-*`, icône lucide) · titre (1 ligne, ellipsis) · description (2 lignes max) · durée typique (`clock` + texte) · coche `circle-check` en haut à droite quand sélectionnée, `lock` quand désactivée, raison à la place de la durée (« Désactivés par l'admin »).
Ligne compacte `ss-titem` : carré 2rem · titre + description sur une ligne · durée + `check` à droite.

| Type | Couleur | Icône (03-iconographie) | Durée typique |
| --- | --- | --- | --- |
| Rétro | `coral` | `layers` | 45–90 min |
| Planning poker | `moss` | `spade` | 30–60 min |
| Whiteboard | `sky` | `pen-tool` | Sans limite |
| Sondage | `iris` | `chart-column` | 5–10 min |
| Icebreaker | `sun` | `sparkles` | 5–15 min |

Les couleurs sont celles de ScreenSessionCreate et des SessionCard ; les icônes suivent le mapping officiel (ScreenSessionCreate utilise encore `sticky-note` / `party-popper`, à aligner).

## Props
```ts
type SessionType = "retro" | "poker" | "whiteboard" | "poll" | "icebreaker";

interface SessionTypeOption {
  value: SessionType;
  label: string;
  description: string;
  duration: string;                   // « 45–90 min », « Sans limite »
  disabledReason?: string;            // présent ⇒ option désactivée (« Icebreakers désactivés par l'admin »)
}

interface SessionTypePickerProps {
  value: SessionType;
  onValueChange: (v: SessionType) => void;
  options?: SessionTypeOption[];      // défaut : les 5 types, filtrés par la config d'instance
  variant?: "tiles" | "compact";      // compact = liste (menu / Drawer)
  label?: string;                     // « Type de session » (aria-labelledby)
  help?: string;
  as?: "radiogroup" | "menu";         // compact dans un DropdownMenu ⇒ "menu"
}
```

## États
défaut · survol (fond `--accent`, bordure 35 % `--primary`) · focus clavier (anneau `--ring` 2px, offset 2px) · sélectionné (bordure + anneau interne `--primary`, fond `--skrum-primary-soft`, coche) · désactivé (fond `--muted`, bordure pointillée, carré à 50 %, cadenas, raison lisible en `--foreground`, non sélectionnable). Compact : ligne active surlignée `--accent`, cochée par `check`, désactivée avec cadenas + raison en sous-titre.

## Accessibilité & clavier
- Tuiles : `role="radiogroup"` + `aria-labelledby` (libellé) + `aria-describedby` (aide) ; chaque tuile `role="radio"`, `aria-checked`, tabindex itinérant (seule la sélection est tabbable).
- <kbd>←</kbd>/<kbd>→</kbd>/<kbd>↑</kbd>/<kbd>↓</kbd> déplacent la sélection en sautant les options désactivées ; <kbd>Espace</kbd> sélectionne ; <kbd>Entrée</kbd> soumet le dialog.
- Désactivée : `aria-disabled="true"` (reste lisible et focusable par le lecteur d'écran) + `aria-describedby` vers la raison. Jamais masquée : l'utilisateur comprend pourquoi.
- Compact en menu : `DropdownMenuRadioGroup` (`menuitemradio`), <kbd>↑</kbd>/<kbd>↓</kbd>, saisie de la première lettre, <kbd>Échap</kbd> ferme et rend le focus au bouton.
- La couleur n'est jamais seule : icône + libellé.

## À faire / À éviter
- Faire : garder l'ordre Rétro → Poker → Whiteboard → Sondage → Icebreaker partout.
- Faire : afficher la raison de désactivation (config admin `features.icebreakers = false`).
- Éviter : retirer silencieusement un type désactivé ; colorer le titre en `--c-t`.
- Éviter : plus de 2 lignes de description — la grille passe de 5 à 2 colonnes sans changer de hauteur de tuile.

## Mapping shadcn / Tailwind
- `@/components/ui/radio-group` : `RadioGroup` `grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(40)),1fr))] gap-2` ; `RadioGroupItem asChild` sur un `<button>` `relative flex flex-col items-start gap-1 rounded-lg border border-input bg-card p-3 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:border-primary data-[state=checked]:bg-skrum-primary-soft data-[state=checked]:ring-1 data-[state=checked]:ring-inset data-[state=checked]:ring-primary data-[disabled]:cursor-not-allowed data-[disabled]:border-dashed data-[disabled]:bg-muted`.
- Carré : `grid size-9 place-items-center rounded-md border bg-skrum-col-coral border-skrum-col-coral-border text-skrum-col-coral-text` (une variante par type).
- Titre `truncate text-sm font-title` ; description `line-clamp-2 text-xs text-muted-foreground` ; durée `mt-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground`.
- Compact : `@/components/ui/dropdown-menu` (`DropdownMenuRadioGroup`, `DropdownMenuRadioItem` en `grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 min-h-12 px-2 py-1.5`), mobile `@/components/ui/drawer` + `RadioGroup` ; menu `w-88 max-w-full`.
- Icônes `lucide-react` : `Layers`, `Spade`, `PenTool`, `ChartColumn`, `Sparkles`, `Clock`, `CircleCheck`, `Lock`, `ShieldCheck`, `Check`.

## Tokens
`--skrum-col-{coral|moss|sky|iris|sun}` + `-border` + `-text` (via `sk-c-*`) `--card` `--muted` `--muted-foreground` `--foreground` `--accent` `--input` `--primary` `--skrum-primary-soft` `--skrum-primary-text` `--ring` `--popover` `--radius` `--radius-md` `--radius-sm` `--space-1` `--space-2` `--space-3` `--duration-fast` `--ease-standard` `--shadow-popover`
