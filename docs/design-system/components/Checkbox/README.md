Contrôles de choix binaire ou exclusif : `Checkbox` (multiple, avec état mixte), `RadioGroup` (un parmi plusieurs), `Switch` (réglage appliqué immédiatement).

**Quand l'utiliser**
- Checkbox : sélection multiple, acceptation, liste d'actions à cocher ; état « mixte » pour un parent partiellement coché.
- RadioGroup : 2 à 5 options exclusives visibles (visibilité des votes, budget de votes) ; variante en cartes pour les choix importants.
- Switch : préférence qui prend effet sans bouton « Enregistrer » (timer, réactions, SSO obligatoire).

**Anatomie**
Contrôle 16 px (`--radius-xs` pour la case, rond pour le radio), coche/barre en `--primary-foreground` sur `--primary` ; Switch 36×20, poignée 16 px. Libellé 14 px à 8 px, description optionnelle 13 px `--muted-foreground`. Radio-carte : bordure `--input`, sélection `--primary` + fond `--skrum-primary-soft`.

**Props**
```ts
interface CheckboxProps { checked: boolean | 'indeterminate'; onCheckedChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }
interface RadioGroupProps<T extends string> { value: T; onValueChange: (v: T) => void; options: { value: T; label: string; description?: string; disabled?: boolean }[]; variant?: 'default' | 'card'; 'aria-label': string }
interface SwitchProps { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean; lockedReason?: string /* ex. « Imposé par l'instance » */ }
```

**États**
Off, on, mixte (checkbox), focus (anneau `--ring` 2 px, offset 2), désactivé off / on (opacité .5), survol (bord `--ring` léger sur la case).

**Accessibilité & clavier**
- Tout le libellé est cliquable (`<label>`) ; cible tactile ≥ 44 px sur mobile via padding.
- Checkbox : `Espace` bascule ; mixte = `aria-checked="mixed"`.
- RadioGroup : `role="radiogroup"` + `aria-label`, `↑ ↓ ← →` changent la sélection, un seul arrêt de tabulation.
- Switch : `role="switch"`, `Espace`/`Entrée` ; un réglage verrouillé explique pourquoi dans sa description.

**Temps réel**
Un réglage de session changé par le facilitateur se met à jour chez tous ; afficher un toast info « Camille a activé les réactions » plutôt qu'un saut silencieux.

**À faire / À éviter**
- Faire : formuler le libellé en positif (« Autoriser… ») ; décrire l'effet sous le libellé.
- Éviter : un Switch dans un formulaire soumis par bouton (→ Checkbox) ; une checkbox seule pour un choix exclusif.

**Tokens**
`--primary` `--primary-foreground` `--input` `--card` `--ring` `--muted-foreground` `--skrum-primary-soft` `--border` `--radius-xs` `--radius` `--duration-base` `--ease-spring`

**Mapping shadcn**
- `@/components/ui/checkbox`, `@/components/ui/radio-group`, `@/components/ui/switch`, `@/components/ui/label`.
- Checkbox : `size-4 rounded-xs border border-input bg-card data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Radio : `size-4 rounded-full border border-input data-[state=checked]:border-primary` + indicateur `size-2 rounded-full bg-primary`. Variante carte : `rounded-lg border border-input p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-skrum-primary-soft`.
- Switch : `h-5 w-9 bg-input data-[state=checked]:bg-primary` ; thumb `size-4 bg-card data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground transition-transform ease-spring`.
