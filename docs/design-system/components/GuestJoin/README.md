Carte « Rejoindre en tant qu'invité » : pseudo, couleur d'avatar parmi 12, aperçu, puis accès à la session sans compte.

## Quand l'utiliser
- Page d'arrivée d'un lien d'invitation (`/s/{code}`) pour un visiteur non connecté, desktop et mobile.
- Pas pour l'inscription : le lien « Se connecter » mène à l'authentification (SSO si configuré par l'admin).

## Anatomie
Logo `skrüm` · titre + sous-titre · résumé de session (type, nom, état, participants, facilitateur) · champ pseudo + aide · sélecteur de 12 couleurs (`sk-p1…12`, cercle 26 px, coche sur la sélection) · aperçu (avatar xl + pseudo + badge « Invitée ») · bouton `lg` pleine largeur · mention anonymat (bouclier) · séparateur · « Vous avez un compte ? Se connecter ».

## Props
```ts
interface GuestJoinProps {
  session: { code: string; kind: "retro" | "poker" | "whiteboard" | "survey"; title: string; status: "live" | "scheduled"; participants: number; facilitator: string };
  defaultName?: string;             // pseudo aléatoire proposé (« Loutre pensive »)
  takenColors?: number[];           // couleurs déjà prises, désactivées
  error?: { field: "name"; message: string } | null;
  processing?: boolean;
  onSubmit: (data: { name: string; presence: number }) => void; // useForm Inertia
  onRandomName?: () => void;
  loginUrl: string;
}
```

## États
rempli + couleur choisie · pseudo vide (aperçu générique, pseudo aléatoire proposé) · erreur pseudo déjà pris (`is-invalid`, message + suggestion, bouton désactivé) · couleur déjà prise (désactivée) · chargement (tréma « Connexion à la session… »).

## Accessibilité & clavier
- `<form>` ; `<label for>` sur le pseudo ; erreur liée par `aria-describedby`, `aria-invalid`.
- Couleurs : `role="radiogroup"` + `aria-label` « Couleur 5 » (et nom de couleur) ; <kbd>←</kbd>/<kbd>→</kbd>.
- <kbd>Entrée</kbd> soumet ; autofocus sur le pseudo.
- Cible tactile ≥ `--touch-target` sur mobile (cercles agrandis à 44 px de zone).

## Temps réel
- Couleurs prises lues via `Echo.join("presence-session.{code}").here()` avant soumission, mises à jour par `.joining`.
- Après soumission : cookie invité signé, puis redirection Inertia vers la session ; la présence est annoncée aux autres par `.joining`.

## Mapping shadcn
`Card`, `Input`, `Label`, `RadioGroup` (pastilles personnalisées), `Avatar`, `Badge variant="secondary"`, `Button size="lg" className="w-full"`, `Separator`. Erreur : `aria-invalid:border-destructive`, texte `text-(--skrum-destructive-text)`.

## À faire / À éviter
- Faire : expliquer l'anonymat en une phrase, sans jargon RGPD.
- Éviter : demander un e-mail à un invité ; bloquer l'entrée si le pseudo est vide (proposer un pseudo aléatoire).

## Tokens
`--card` `--muted` `--foreground` `--muted-foreground` `--border` `--input` `--ring` `--primary` `--primary-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-presence-1…12` + `-foreground` `--skrum-success` `--skrum-destructive-text` `--destructive` `--font-display` `--radius` `--radius-md` `--radius-xl` `--shadow-card` `--touch-target` `--space-3` `--space-5` `--space-6`
