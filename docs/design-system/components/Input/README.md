Champ de saisie mono-ligne (`Input`) et multi-ligne (`Textarea`) de Skrüm, thémés sur les tokens shadcn.

**Quand l'utiliser**
- Saisie libre courte (nom de session, prénom d'invité, e-mail) → `Input`.
- Texte d'une carte, contexte d'une action → `Textarea` avec compteur (limite 280 par défaut).
- Pour une valeur parmi une liste, utilisez `Select`/`Combobox`.

**Anatomie**
Label (`sk-lbl`, 14/600) → contrôle (36 px, `--radius-md`, bord `--input`, fond `--card`) → aide (`sk-help`) ou erreur (`sk-error-msg` + icône `circle-alert`). Icône préfixe optionnelle à 10 px (`sk-input-group`), bouton suffixe ghost 28 px. Compteur aligné à droite sous le textarea.

**Props**
```ts
interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;            // pose aria-invalid + aria-describedby
  icon?: LucideIcon;         // préfixe
  suffix?: React.ReactNode;  // ex. bouton Copier
}
interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: string;
  error?: string;
  maxLength?: number;        // affiche le compteur « n/max »
  warnAt?: number;           // défaut : 90 % de maxLength → compteur warning
}
```

**États**
- Défaut, placeholder (`--muted-foreground`), focus (anneau 2 px `--ring` + bord `--ring`).
- Invalide : bord `--destructive`, message `--skrum-destructive-text` ; invalide + focus : anneau `--destructive`.
- Désactivé : opacité .55, fond `--muted`, label atténué.
- Compteur proche de la limite : `--skrum-warning-text`, gras.

**Accessibilité & clavier**
- `<label for>` toujours présent ; l'aide et l'erreur sont reliées par `aria-describedby`, l'erreur pose `aria-invalid="true"`.
- Le compteur est annoncé via `aria-live="polite"` seulement quand il passe le seuil d'avertissement.
- Bouton suffixe icône : `aria-label` obligatoire (« Copier »).
- `Cmd/Ctrl+Entrée` publie une carte depuis le textarea ; `Esc` annule l'édition.

**À faire / À éviter**
- Faire : valider au blur puis en direct une fois l'erreur affichée ; message d'erreur qui dit quoi corriger.
- Faire : placeholder = exemple, jamais la consigne (la consigne va dans le label).
- Éviter : bloquer la saisie au-delà de la limite sans compteur visible.
- Éviter : rouge sur le fond du champ ; seul le bord et le message portent l'erreur.

**Tokens**
`--card` `--input` `--foreground` `--muted-foreground` `--muted` `--ring` `--destructive` `--skrum-destructive-text` `--skrum-warning-text` `--radius-md` `--space-2` `--space-3` `--duration-fast` `--ease-standard` `--font-mono`

**Mapping shadcn**
- `@/components/ui/input`, `@/components/ui/textarea`, `@/components/ui/label` (+ `form` avec react-hook-form si besoin).
- Input : `h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:opacity-55 disabled:bg-muted`.
- Erreur : `text-body-sm text-skrum-destructive-text flex items-center gap-1.5`. Icône préfixe : wrapper `relative` + `absolute left-2.5 text-muted-foreground` + `pl-8` sur l'input.
- Compteur : `text-xs tabular-nums text-muted-foreground data-[near]:text-skrum-warning-text data-[near]:font-semibold`.
