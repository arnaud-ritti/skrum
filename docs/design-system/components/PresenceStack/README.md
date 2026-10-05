Pile de présence : avatars des participants connectés, « +N », statut en ligne/absent, qui écrit, invités, et popover de la liste complète.

## Quand l'utiliser
- Topbar de toute session temps réel (rétro, poker, whiteboard, sondage live).
- Version liste dans le popover ou le panneau latéral « Participants ».

## Anatomie
Bouton pilule · `sk-stack` : 5 avatars max (couleur de présence `sk-p1…12`, initiales) chevauchés de 8 px, anneau `--background` · pastille « +N » · libellé « 12 en ligne ». Statut : point `--skrum-success` (en ligne) / `--muted-foreground` (absent) ; anneau de la couleur du participant quand il écrit ; invité : avatar contour + icône.

## Props
```ts
interface Participant {
  id: string;
  name: string;                     // pseudo pour un invité
  initials: string;
  presence: number;                 // 1..12, attribuée à la connexion
  role: "facilitator" | "member" | "guest";
  status: "online" | "away" | "offline";
  typing?: boolean;
  isMe?: boolean;
}

interface PresenceStackProps {
  participants: Participant[];
  max?: number;                     // défaut 5
  size?: "sm" | "md";
  onInvite?: () => void;
}
```

## États
pile + « +N » · en ligne / absent (onglet inactif > 60 s) / déconnecté (opacité .55) · en train d'écrire (anneau couleur + tréma « Inès et Yuki écrivent… ») · invités anonymes (contour, pseudo généré « Loutre pensive ») · popover liste (facilitateur en premier, « toi » ensuite, puis en ligne, absents, invités).

## Accessibilité & clavier
- Bouton `aria-haspopup="dialog"`, `aria-label="12 participants connectés, voir la liste"`.
- Popover `role="dialog"`, focus piégé, <kbd>Échap</kbd> ferme ; liste `<ul>` avec statut en texte (« Absente depuis 3 min »).
- Les initiales sont doublées par `title`/nom dans la liste ; le point de statut n'est jamais la seule information.

## Temps réel
- `Echo.join("presence-retro.{sessionId}")` : `.here()` initialise, `.joining()` / `.leaving()` mettent à jour (entrée avec `sk-enter`).
- Absent : whisper `client-away` à `visibilitychange`, retour à `focus`.
- Écriture : whisper `client-typing {cardId}` throttlé 1/2 s, expiré à 4 s.
- Couleur de présence : attribuée par le serveur (plus petit index libre), stable pendant la session.

## Mapping shadcn
`Avatar` / `AvatarFallback` (`size-8 ring-2 ring-background -ml-2`), `Popover` (`w-80 p-2`), `Badge variant="secondary"`, `Button variant="ghost" size="sm"` pour « Inviter ».

## À faire / À éviter
- Faire : toujours afficher le total réel (« 12 en ligne »), pas seulement « +7 ».
- Éviter : photos d'invités ; exposer l'e-mail d'un membre dans la liste.

## Tokens
`--skrum-presence-1…12` + `-foreground` (via `sk-p*`) `--background` `--card` `--popover` `--border` `--input` `--muted` `--muted-foreground` `--skrum-success` `--skrum-success-soft` `--skrum-success-text` `--primary` `--skrum-primary-text` `--shadow-card` `--shadow-popover` `--radius-full` `--radius` `--space-2` `--space-3`
