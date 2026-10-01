Réglage d'une valeur numérique (`Slider`) et indication d'avancement (`Progress`).

**Quand l'utiliser**
- Slider : valeur approximative dans une plage bornée (votes par participant, durée de phase, taille d'équipe) ; plage à deux poignées pour min–max.
- Progress : avancement connu (participants ayant voté, actions faites) ou tâche longue sans durée connue (indéterminé : export Jira, import).
- Valeur exacte ou saisie fréquente → `Input type="number"`.

**Anatomie**
Label + valeur courante (mono, tabulaire) en ligne → piste 6 px (`--muted`) avec plage `--primary` → poignée 18 px bord `--primary` ; bornes en 11 px sous la piste ; bulle de valeur (`--foreground`/`--background`) pendant le drag ou le focus. Progress : piste 8 px, remplissage `--primary` (ou `--skrum-success` à 100 % / actions faites), libellé et « n / total » au-dessus, aide dessous.

**Props**
```ts
interface SliderProps { label: string; value: number[]; onValueChange: (v: number[]) => void; min: number; max: number; step?: number; format?: (v: number) => string; showBounds?: boolean; disabled?: boolean }
interface ProgressProps { value?: number /* undefined = indéterminé */; max?: number; label?: string; valueLabel?: string /* « 7 / 9 » */; tone?: 'primary' | 'success'; description?: string }
```

**États**
Slider : valeur simple, focus clavier + bulle, plage (2 poignées), désactivé. Progress : 0 %, partiel, 100 % succès, avec libellé, indéterminé (segment qui glisse ; figé si `prefers-reduced-motion`).

**Accessibilité & clavier**
- Slider : `role="slider"`, `aria-valuemin/max/now` et `aria-valuetext` formaté (« 8 minutes ») ; `← →` ±step, `Page ↑/↓` ±10 %, `Début/Fin`.
- Progress : `role="progressbar"` + `aria-valuenow` ; indéterminé sans `aria-valuenow` et `aria-busy="true"` sur la zone concernée.
- La valeur est toujours écrite en texte, jamais uniquement par la longueur de barre.

**Temps réel**
La progression « ont voté » s'incrémente à chaque vote reçu (transition `--duration-base`) ; ne pas annoncer chaque incrément au lecteur d'écran, seulement « Tout le monde a voté ».

**À faire / À éviter**
- Faire : borner les sliders à des plages utiles ; afficher l'unité.
- Éviter : slider pour choisir parmi 3 valeurs (→ Radio) ; progress indéterminé pour une durée > 10 s sans texte d'état.

**Tokens**
`--primary` `--muted` `--border` `--card` `--foreground` `--background` `--muted-foreground` `--skrum-success` `--ring` `--shadow-card` `--radius-sm` `--duration-base` `--ease-standard` `--font-mono`

**Mapping shadcn**
- `@/components/ui/slider` (Radix, tableau de valeurs → plage native), `@/components/ui/progress`.
- Slider : Track `h-1.5 rounded-full bg-muted ring-1 ring-inset ring-border`, Range `bg-primary`, Thumb `size-4.5 rounded-full border-2 border-primary bg-card shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Progress : `h-2 rounded-full bg-muted ring-1 ring-inset ring-border` + Indicator `bg-primary` (`bg-skrum-success` en variante success) ; indéterminé : classe `animate-indeterminate w-[38%]`, `motion-reduce:animate-none`.
