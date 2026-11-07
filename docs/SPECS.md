# Rest timer — spécifications

> Statut : **prêt pour validation**. Toutes les questions ouvertes ont été
> tranchées.

## Contexte

Projet Astro (template minimal, TypeScript, Astro 7).
L'app est utilisée sur une tablette (iPad / Android) dans le navigateur, posée
près de la zone d'entraînement, et idéalement ajoutée à l'écran d'accueil pour
s'ouvrir comme une appli.

## Objectif

Mesurer le **temps de repos** entre deux séries pendant l'entraînement.
C'est un **compte à rebours** : on choisit une durée, l'app décompte jusqu'à 0
et prévient quand il faut reprendre.

### Hors périmètre (pour l'instant)
- Le temps actif (durée des séries) n'est pas mesuré.
- Pas de comptage des séries, pas d'historique, pas de statistiques.

## Fonctionnalités

### Boutons de durée
- Deux gros boutons : **30 s** et **60 s**.
- Un appui lance immédiatement le compte à rebours de la durée du bouton.
- Réagit dès qu'on touche l'écran (`pointerdown`), sans confirmation.
- Appui sur un bouton **pendant** un décompte : le décompte repart de zéro
  avec la durée du bouton (30 → 60, 60 → 30 ou relance du même).
  Les boutons restent donc visibles pendant le décompte.
- Les durées sont fixes (30 et 60 s), non personnalisables.

### Arrêt
- Un appui sur le décompte annule le repos en cours et revient à l'écran
  d'accueil. Pas de bouton « Stop » dédié.
- Pas de pause : un repos se fait d'une traite.

### Affichage
- Secondes restantes en très grand, lisibles de loin (taille en `vmin`).
- Format : nombre de secondes seul (`60`, `59`… `1`), pas de `mm:ss`.
- Arrondi au supérieur : on affiche `1` jusqu'à la toute fin, `0` uniquement
  à l'échéance.
- Chiffres à chasse fixe (`tabular-nums`) pour qu'ils ne bougent pas.
- Un anneau de progression autour du chiffre, qui se vide en continu
  (animation fluide, pas par saccades d'une seconde). Il prend la couleur de
  la phase en cours (orange, puis rouge).

### Alertes
Trois moments distincts :

| Moment | Restant | Son | Visuel |
|---|---|---|---|
| Préavis | 10 s | un bip | l'écran passe en orange |
| Décompte final | 5, 4, 3, 2, 1 s | un bip court par seconde | l'écran passe en rouge, chiffre qui pulse, léger clignotement du fond |
| Reprise | 0 s | un son distinct : bip long, plus aigu | écran vert plein « GO » |

- Clignotement du décompte final : à chaque seconde (5 → 1), le fond rouge
  s'éclaircit brièvement (~200 ms) puis revient, en même temps que le bip.
  L'effet reste léger : pas de flash blanc ni d'alternance agressive.
  Avec le réglage système « réduire les animations », pas de clignotement
  (le rouge et le pulse du chiffre suffisent).
- Sons générés via Web Audio (aucun fichier à charger).
- Les sons ne sont joués que si le son est activé (voir ci-dessous). Les
  alertes visuelles, elles, sont toujours affichées.
- Pas de vibration.
- Avec un repos de 30 s, le préavis tombe à 20 s écoulées ; ça reste cohérent.

### Son (mode silencieux par défaut)
- Au premier lancement, l'app est **silencieuse** : aucune alerte sonore.
- Un petit bouton haut-parleur, dans un coin de l'écran, active ou coupe le
  son. Icône barrée quand le son est coupé.
- Visible dans tous les états (accueil, décompte, GO), discret pour ne pas
  gêner la lecture du chiffre, mais avec une zone tactile d'au moins 44 px.
- Un appui sur ce bouton ne lance ni n'annule le décompte.
- Activer le son pendant un décompte fait entendre les alertes suivantes ;
  le couper rend l'app muette immédiatement.
- À l'activation, un bip court confirme que le son fonctionne (utile pour
  repérer l'interrupteur silencieux ou un volume à zéro).
- Le choix est mémorisé dans le `localStorage` : l'app se rouvre avec le
  dernier réglage. Sans `localStorage` (navigation privée), retour au mode
  silencieux.

### Fin du repos
- L'écran « GO » reste affiché 3 s, puis l'app revient automatiquement à
  l'écran d'accueil, prête pour le repos suivant.
- Pendant ces 3 s, un appui sur 30 ou 60 lance directement un nouveau repos.
- Pas d'affichage du dépassement.

## Contraintes techniques

- **Une seule page** (`src/pages/index.astro`), avec le JavaScript côté client
  dans un `<script>` Astro. Pas de framework (React, Vue…).
- **Précision** : le temps restant est toujours calculé à partir de l'heure de
  fin, jamais en décrémentant un compteur.
  - État : `{ endTime, duration }`, avec `restant = endTime - Date.now()`.
  - Affichage rafraîchi avec `requestAnimationFrame`.
  - Chaque alerte n'est jouée qu'une fois (on mémorise les seuils déjà
    franchis), même si une frame saute.
- **Son sur iPad** : iOS n'autorise le son qu'après une action de
  l'utilisateur, et un simple contact du doigt (`pointerdown`) ne compte pas :
  il faut le doigt relevé (`pointerup` / `touchend`), un clic ou une touche.
  L'`AudioContext` est donc créé/débloqué au clic sur le bouton son, puis à
  chaque doigt relevé n'importe où si le son est activé (l'appui sur 30 / 60
  suffit). Cela couvre le réglage restauré au rechargement et une coupure de
  l'audio par iOS. Les décomptes, eux, démarrent toujours dès le `pointerdown`.
- **Arrière-plan** : si l'onglet est masqué puis réaffiché, le décompte se
  recale sur `endTime`. L'état est sauvegardé dans le `localStorage` pour
  survivre à un rechargement de la page par le système (iOS).
- **Mise en veille** : la Wake Lock API empêche l'écran de s'éteindre pendant
  un décompte.
  - Le verrou est redemandé à chaque `visibilitychange`.
  - Si l'API n'est pas supportée, l'app fonctionne sans, sans message d'erreur.
- **Tactile** :
  - `touch-action: manipulation` (pas de zoom au double-tap).
  - `user-select: none` et `-webkit-touch-callout: none`.
  - Pas de surlignage au tap.
- **Mise en page** :
  - Plein écran (`100dvh`), en tenant compte des `safe-area-inset`.
  - Accueil : les deux boutons occupent l'écran (empilés en portrait, côte à
    côte en paysage).
  - Décompte : le chiffre occupe l'essentiel de l'écran (zone tactile pour
    annuler), et les boutons 30/60 restent accessibles pour relancer.
- **PWA** :
  - `public/manifest.webmanifest` (`display: standalone`), icônes 192/512 px
    et maskable, plus un `apple-touch-icon` de 180 px.
  - Balises `apple-mobile-web-app-*` pour iPad.
  - Fonctionnement hors ligne : service worker écrit à la main
    (`public/sw.js`, cache-first), sans dépendance.
- **Hébergement** : GitHub Pages, à l'adresse
  `https://sernar.github.io/rest-timer/` (HTTPS fourni par GitHub).
  - Déploiement automatique par GitHub Actions à chaque push sur `main`.
  - L'app est servie dans un sous-dossier (`/rest-timer/`) : tous les chemins
    (manifeste, icônes, service worker) doivent en tenir compte.

## Limites connues

- **Interrupteur silencieux / volume** : sur iPad, le son Web Audio peut être
  coupé par le mode silencieux ou un volume à zéro. Les alertes visuelles
  restent la garantie minimale.
- **App en arrière-plan ou écran verrouillé** : le navigateur suspend le
  JavaScript, donc **aucune alerte** n'est jouée tant que l'app n'est pas au
  premier plan. D'où l'importance de la Wake Lock API.
- Le service worker et la Wake Lock API demandent **HTTPS** (ou `localhost`).
  En test sur la tablette via `npm run dev -- --host` (`http://192.168.x.x`),
  ces deux fonctions sont inactives. La vraie PWA se teste sur la version
  déployée sur GitHub Pages.

## Déroulé

1. Valider ces spécifications.
2. Implémenter, puis vérifier que `npm run build` passe sans erreur.
3. Tester sur la tablette via `npm run dev -- --host`.
4. Déployer sur GitHub Pages, installer l'app sur la tablette et tester la
   PWA (hors ligne, Wake Lock, plein écran).
