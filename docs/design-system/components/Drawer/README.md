Panneau mobile qui monte du bas de l'écran pour un choix rapide (carte de vote au planning poker, réaction emoji).

**Quand l'utiliser**
- Participant sur mobile (< 640 px) : choisir sa carte, réagir, voir les détails d'une carte, régler son pseudo.
- Remplace `Popover`, `Dialog` et `DropdownMenu` sur mobile pour les choix tactiles.
- Desktop → `Popover` (réactions) ou `Dialog`.

**Anatomie**
Overlay → feuille `--popover`, coins haut `--radius-2xl`, poignée 40×5 (`--border`) → titre centré 17/650 + description → contenu (grille de `sk-pcard` 5 colonnes ; grille d'emoji 6 colonnes, cibles 48 px) → action principale pleine largeur (44 px) → action secondaire ghost. Marge basse = safe area + 32 px.

**Props**
```ts
interface VoteDrawerProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  deck: (string | number)[];          // ['1','2','3','5','8','13','21','?','☕']
  value?: string; disabledValues?: string[];
  onVote: (v: string) => void; onRetract?: () => void;
}
interface ReactionDrawerProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  cardExcerpt: string;
  reactions: { emoji: string; count: number; mine: boolean }[];
  palette: string[];                  // 11 emoji + « plus »
  onToggle: (emoji: string) => void;
}
```

**États**
Ouvert (monte en `--duration-slow` `--ease-enter`), carte sélectionnée (levée de 10 px, fond `--skrum-primary-soft`, anneau `--primary`), carte spéciale (?, ☕ sur `--muted`), carte indisponible (opacité .4), réaction déjà ajoutée (`is-on`), glisser vers le bas pour fermer.

**Accessibilité & clavier**
- `role="dialog"` + `aria-labelledby` ; le deck est un `radiogroup`, chaque carte un `radio` avec `aria-label="5 points"`.
- Emoji : `button` `aria-pressed` + `aria-label` en français (« Fête »).
- Cibles ≥ 44 px (`--touch-target`) ; fermeture aussi possible par bouton, pas seulement par geste.

**Temps réel**
Si le facilitateur révèle les votes pendant que le drawer est ouvert, le fermer et afficher la révélation ; le compteur « 5 / 8 ont voté » en fond reste à jour.

**À faire / À éviter**
- Faire : un seul choix par drawer ; retour haptique léger à la sélection (natif si dispo).
- Éviter : formulaire long dans un drawer ; drawer qui dépasse 85 % de la hauteur.

**Tokens**
`--popover` `--border` `--card` `--primary` `--primary-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--muted` `--muted-foreground` `--shadow-modal` `--radius-2xl` `--radius-xl` `--radius` `--duration-slow` `--duration-base` `--ease-enter` `--ease-spring` `--touch-target`

**Mapping shadcn**
- `@/components/ui/drawer` (Vaul) : `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`.
- Content : `rounded-t-2xl border border-b-0 bg-popover px-5 pb-8 pt-2 shadow-modal` ; poignée native Vaul restylée `h-1.25 w-10 bg-border`.
- Deck : `grid grid-cols-5 gap-2 justify-items-center` ; carte choisie `-translate-y-2.5 bg-skrum-primary-soft text-skrum-primary-text ring-2 ring-primary`.
- Pattern responsive : `useMediaQuery('(min-width: 40rem)') ? <Popover/Dialog> : <Drawer>`.
