Champ de code à usage unique (6 chiffres en deux groupes de 3) pour vérifier un e-mail, confirmer une connexion ou activer la double authentification.

**Quand l'utiliser**
- Vérification de l'adresse à l'inscription, connexion par code magique, 2FA (TOTP), confirmation d'une action sensible d'admin d'instance (rotation du certificat SSO).
- Pas pour le lien d'invitation d'une session (→ lien ou QR code, `GuestJoin`) ni pour un mot de passe.

**Anatomie**
Libellé → groupe de 6 cases 40 × 44 px (36 px dans une carte étroite) jointes par 3 (`--input`, coins `--radius-md` aux extrémités), chiffres `--font-mono` 20/600 tabulaires, séparateur `minus` `--muted-foreground` → message (erreur, collage, vérification) → ligne de renvoi : « Rien reçu ? Renvoyer le code dans 0:42 » (compte à rebours tabulaire), puis bouton ghost sm `rotate-cw` « Renvoyer le code » en `--skrum-primary-text`. Carte de vérification : pastille `mail-check` `--skrum-primary-soft`, titre, adresse en gras, bouton « Vérifier » désactivé tant que le code est incomplet, lien « Utiliser une autre adresse ».

**Props**
```ts
interface InputOTPProps {
  length?: 6;                          // groupes 3-3
  value: string; onChange: (v: string) => void;
  onComplete?: (code: string) => void; // soumission auto au 6e chiffre
  pattern?: RegExp;                    // /^\d+$/ (REGEXP_ONLY_DIGITS)
  label: string;
  error?: string;                      // « Code invalide. Encore 2 essais. »
  disabled?: boolean;                  // pendant la vérification
  pasted?: boolean;                    // flash de confirmation après collage
}
interface ResendCodeProps { cooldownSeconds: number; remaining: number; onResend: () => void; sentTo?: string; locale: 'fr' | 'en' }
```

**États**
Vide, focus (case active : bord + anneau 2 px `--ring`, curseur clignotant), en cours de saisie, rempli, erreur (bords `--destructive`, chiffres `--skrum-destructive-text`, secousse `sk-nudge` unique, message), collé (fond `--skrum-success-soft` bref + « Code collé depuis le presse-papiers »), désactivé / vérification (opacité .55, `--muted`, spinner), renvoi en attente (compte à rebours), renvoi disponible, nouveau code envoyé (`--skrum-success-text`).

**Accessibilité & clavier**
- Un seul `<input inputmode="numeric" autocomplete="one-time-code" maxlength="6">` réel (les cases sont `aria-hidden`), nommé par le libellé : lecteurs d'écran, autofill SMS/e-mail et gestionnaires de mots de passe fonctionnent.
- Saisie avance d'une case, `Retour arrière` efface et recule, `← →` déplacent, collage d'un code complet remplit tout (espaces et tirets ignorés).
- Erreur reliée par `aria-describedby` + `aria-invalid` ; après une erreur, le contenu est sélectionné pour être retapé.
- Compte à rebours non annoncé chaque seconde : seule la fin (« Vous pouvez renvoyer le code ») passe en `aria-live="polite"`. Animations coupées en mouvement réduit.

**À faire / À éviter**
- Faire : soumettre automatiquement au 6e chiffre ; rappeler l'adresse de destination ; délai de renvoi de 60 s ; expiration du code indiquée (« valable 10 minutes »).
- Éviter : 6 inputs séparés (casse l'autofill et le collage) ; effacer le code sur erreur sans le sélectionner ; codes alphanumériques ambigus (0/O, 1/l).

**Tokens**
`--card` `--input` `--foreground` `--muted` `--muted-foreground` `--ring` `--destructive` `--skrum-destructive-text` `--skrum-success` `--skrum-success-soft` `--skrum-success-text` `--skrum-primary-soft` `--skrum-primary-text` `--font-mono` `--radius-md` `--radius-xl` `--duration-fast` `--ease-standard`

**Mapping shadcn**
- `@/components/ui/input-otp` (input-otp) : `InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS}`, `InputOTPGroup`, `InputOTPSlot index={n}`, `InputOTPSeparator` (icône `Minus`).
- Slot : `relative flex h-11 w-10 items-center justify-center border-y border-r border-input bg-card font-mono text-xl font-semibold tabular-nums first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring aria-invalid:border-destructive aria-invalid:text-skrum-destructive-text` ; étroit : `@max-card-wide/card:w-9`.
- Groupe : `flex items-center gap-2 has-disabled:opacity-55` ; collé : `bg-skrum-success-soft` 1 s ; curseur : `animate-caret-blink h-5 w-px bg-foreground`.
- Renvoi : `Button variant="ghost" size="sm" className="-ml-3 text-skrum-primary-text"` ; compte à rebours `text-body-sm text-muted-foreground tabular-nums`.
