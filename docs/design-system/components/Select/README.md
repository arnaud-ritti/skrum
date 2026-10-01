Liste déroulante (`Select`) et liste filtrable (`Combobox`) pour choisir une valeur parmi des options connues.

**Quand l'utiliser**
- `Select` : ≤ 10 options stables (modèle de rétro, échelle de vote, couleur de colonne).
- `Combobox` : liste longue ou dynamique à filtrer (assigner un membre, lier un ticket Jira), avec création possible.
- Pour 2–4 options visibles d'un coup, préférez un `RadioGroup`.

**Anatomie**
Déclencheur (36 px, comme `Input`, chevron `chevron-down` ; `chevrons-up-down` pour le combobox) → contenu `sk-menu` (popover, `--shadow-popover`, `--radius`) → libellés de groupe, items 32 px, coche `check` à droite pour la valeur choisie, séparateurs. Combobox : champ de recherche en tête, correspondance surlignée (`--skrum-primary-text`, gras), état vide avec action « Créer ».

**Props**
```ts
interface SelectOption { value: string; label: string; group?: string; disabled?: boolean; icon?: React.ReactNode }
interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}
interface ComboboxProps extends Omit<SelectProps, 'placeholder'> {
  searchPlaceholder?: string;
  emptyText?: string;                 // « Aucun ticket trouvé. »
  onCreate?: (query: string) => void; // affiche « Créer « query » »
  renderOption?: (o: SelectOption) => React.ReactNode; // ex. avatar + nom
}
```

**États**
Fermé (placeholder / valeur), focus, invalide + message, désactivé, ouvert, item actif clavier (`--accent`), option sélectionnée (coche), item désactivé, recherche filtrée, aucun résultat.

**Accessibilité & clavier**
- Déclencheur `role="combobox"` + `aria-expanded` + `aria-controls` ; liste `role="listbox"`, options `aria-selected`.
- `↑ ↓` déplacent l'item actif, `Entrée` valide, `Esc` ferme et rend le focus au déclencheur, frappe de lettres = saut (Select).
- Combobox : le focus reste dans le champ, l'item actif est porté par `aria-activedescendant`.
- La couleur d'une pastille n'est jamais seule : le nom de la couleur est écrit.

**Temps réel**
Un membre qui rejoint l'équipe apparaît dans le combobox d'assignation sans recharger ; une option retirée pendant l'ouverture passe en désactivé plutôt que de disparaître sous le curseur.

**À faire / À éviter**
- Faire : grouper au-delà de 6 options ; garder l'item sélectionné visible à l'ouverture.
- Éviter : un Select pour « Oui / Non » (→ Switch) ; filtrer côté client une liste de plus de 500 éléments.

**Tokens**
`--card` `--input` `--popover` `--popover-foreground` `--accent` `--accent-foreground` `--muted-foreground` `--border` `--ring` `--destructive` `--skrum-primary-text` `--shadow-popover` `--radius` `--radius-md` `--radius-sm` `--skrum-col-*` (pastilles)

**Mapping shadcn**
- `@/components/ui/select` (Radix Select) ; Combobox = `@/components/ui/popover` + `@/components/ui/command` (pattern shadcn « Combobox »).
- Trigger : `h-9 w-full rounded-md border border-input bg-card px-3 text-sm data-[placeholder]:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive`.
- Content : `rounded-lg border bg-popover text-popover-foreground shadow-popover p-1`. Item : `h-8 rounded-sm px-2 text-sm data-[highlighted]:bg-accent data-[disabled]:opacity-50`. Label : `px-2 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground`.
- Surlignage recherche : `<mark className="bg-transparent font-bold text-skrum-primary-text">`.
