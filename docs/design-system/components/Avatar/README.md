Pastille d'identité d'un participant : photo ou initiales sur sa couleur de présence, avec statut, frappe en cours et variante invité.

**Quand l'utiliser**
- Auteur d'une carte, responsable d'une action, sièges du poker, pile de présence, sidebar.
- La couleur de présence (1 à 12) est attribuée à l'entrée dans la session et reste la même pour le curseur, le verrou d'édition et l'avatar.

**Anatomie**
Cercle ; tailles xs 20, sm 24, md 32, lg 40, xl 56 ; initiales 700 (2 lettres max). Fond/texte `--skrum-presence-N` / `-N-foreground` via `sk-pN`. Pastille de statut 10 px en bas à droite (en ligne `--skrum-success`, absent `--muted-foreground`) détourée `--card`. En train d'écrire : anneau 2 px dans la couleur de présence + `sk-trema`. Invité : fond `--card`, contour `--input`, icône `user-round` ; anonyme : « ? ». Pile : chevauchement −8 px, anneau `--background`, reste « +N ».

**Props**
```ts
interface AvatarProps {
  name: string;                         // initiales dérivées
  presence?: 1|2|3|4|5|6|7|8|9|10|11|12;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'away';
  typing?: boolean;
  kind?: 'member' | 'guest' | 'anonymous';
}
interface AvatarStackProps { people: AvatarProps[]; max?: number /* 5 */; size?: AvatarProps['size'] }
```

**États**
Image chargée, chargement (skeleton), échec → initiales, en ligne, absent, en train d'écrire, invité, anonyme.

**Accessibilité & clavier**
- `aria-label` avec le nom (et le statut : « Inès B., en ligne ») ; initiales `aria-hidden` si le nom est écrit à côté.
- Le statut n'est jamais porté par la seule couleur : tooltip + texte dans les listes de participants.
- Paires présence/foreground validées AA sur les deux thèmes.

**Temps réel**
Statut et frappe via presence channel ; l'anneau « écrit » disparaît après 3 s d'inactivité ; l'entrée d'un participant ajoute l'avatar à la pile avec `--ease-spring`.

**À faire / À éviter**
- Faire : garder la même couleur pour une personne pendant toute la session.
- Éviter : utiliser les couleurs de présence pour autre chose que l'identité ; 3 lettres d'initiales.

**Tokens**
`--skrum-presence-1..12` `--skrum-presence-1..12-foreground` `--muted` `--muted-foreground` `--card` `--input` `--background` `--skrum-success` `--radius-full` `--duration-base` `--ease-spring`

**Mapping shadcn**
- `@/components/ui/avatar` : `Avatar`, `AvatarImage`, `AvatarFallback`.
- Avatar : `size-8 rounded-full` (tailles `size-5/6/8/10/14`) ; Fallback : `bg-skrum-presence-5 text-skrum-presence-5-foreground text-xs font-bold` (classe générée depuis `presence`).
- Statut : `absolute -right-px -bottom-px size-2.5 rounded-full bg-skrum-success ring-2 ring-card`. Frappe : `ring-2 ring-offset-2 ring-offset-card ring-skrum-presence-5`.
- Pile : `flex -space-x-2 [&>*]:ring-2 [&>*]:ring-background`.


## Avatars DiceBear

Par défaut, l'avatar est une illustration DiceBear générée à partir de l'id de la personne (style choisi par l'admin, voir **AvatarStylePicker**), sur fond `skrum-presence-N`. Les initiales restent le fallback (chargement, style « Initiales », génération désactivée).
