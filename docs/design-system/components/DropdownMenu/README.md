Menu contextuel déclenché par un bouton (ici le « … » d'une carte de rétro) : actions, sous-menu, cases et radios.

**Quand l'utiliser**
- Actions secondaires d'un objet : éditer, fusionner, déplacer vers une colonne, dupliquer, créer une action, supprimer.
- Options d'affichage (cases à cocher, tri en radio).
- Navigation ou recherche globale → `Command` ; choix d'une valeur de formulaire → `Select`.

**Anatomie**
Contenu `sk-menu` (≥ 220 px, padding 4, `--shadow-popover`) → libellé de section (12/600 muted) → items 32 px : icône 16 muted, libellé, raccourci à droite (`sk-shortcut`) → séparateurs (`--border`, bord à bord) → sous-menu signalé par `chevron-right`, ouvert à droite avec la valeur actuelle cochée → item danger en dernier (`--skrum-destructive-text`) → item désactivé avec raison courte à droite.

**Props**
```ts
type MenuEntry =
  | { type: 'item'; label: string; icon?: LucideIcon; shortcut?: string; onSelect: () => void; disabled?: boolean; disabledReason?: string; tone?: 'default' | 'danger' }
  | { type: 'sub'; label: string; icon?: LucideIcon; items: MenuEntry[] }
  | { type: 'checkbox'; label: string; checked: boolean; onCheckedChange: (v: boolean) => void }
  | { type: 'radio'; value: string; items: { value: string; label: string }[]; onValueChange: (v: string) => void }
  | { type: 'separator' } | { type: 'label'; label: string };
interface CardMenuProps { trigger: React.ReactNode; entries: MenuEntry[]; align?: 'start' | 'end' }
```

**États**
Déclencheur ouvert (ghost en survol), item actif clavier (`--accent`), sous-menu ouvert (déclencheur reste actif), élément coché, item désactivé (opacité .5), item danger.

**Accessibilité & clavier**
- `role="menu"` / `menuitem` / `menuitemcheckbox` / `menuitemradio` ; déclencheur `aria-haspopup="menu"` + `aria-expanded`.
- `↑ ↓` naviguent, `→` ouvre le sous-menu, `←` le ferme, `Entrée`/`Espace` active, `Esc` ferme, frappe = saut à l'item.
- Les raccourcis affichés fonctionnent aussi sur la carte focalisée (E, ⌘M, ⌘D, ⌫).

**Temps réel**
Si une autre personne édite la carte (`is-locked`), « Éditer » et « Fusionner » passent en désactivé avec la raison « Inès écrit ».

**À faire / À éviter**
- Faire : ≤ 8 items visibles, destructif isolé en bas après un séparateur, confirmation (Dialog) ou toast « Annuler » pour la suppression.
- Éviter : sous-menus sur deux niveaux ; icônes sur certains items seulement d'un même groupe.

**Tokens**
`--popover` `--popover-foreground` `--border` `--accent` `--accent-foreground` `--muted-foreground` `--foreground` `--skrum-destructive-text` `--skrum-col-*` `--shadow-popover` `--radius` `--radius-sm` `--duration-base` `--ease-enter`

**Mapping shadcn**
- `@/components/ui/dropdown-menu` : `DropdownMenuContent`, `Item`, `Sub`/`SubTrigger`/`SubContent`, `CheckboxItem`, `RadioGroup`/`RadioItem`, `Label`, `Separator`, `Shortcut`.
- Item : `h-8 gap-2 rounded-sm px-2 text-sm data-[highlighted]:bg-accent data-[disabled]:opacity-50 [&_svg]:text-muted-foreground` ; `variant="destructive"` → `text-skrum-destructive-text [&_svg]:text-current`.
- Shortcut : `ml-auto text-xs tracking-widest text-muted-foreground`. SubTrigger ouvert : `data-[state=open]:bg-accent`.
