# Rest timer — plan d'implémentation

Référence : `SPECS.md` (validé). Aucune dépendance ajoutée en dehors d'Astro.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/pages/index.astro` | Markup, styles, `<script>` qui branche les modules |
| `src/scripts/timer.ts` | Logique pure : états, calcul du restant, phases, seuils d'alerte |
| `src/scripts/audio.ts` | `AudioContext`, déblocage iOS, 3 sons (préavis, tic, GO) |
| `src/scripts/wakelock.ts` | Prise / libération / reprise du Wake Lock |
| `src/scripts/storage.ts` | Sauvegarde / restauration de l'état dans le `localStorage` |
| `public/manifest.webmanifest` | Manifeste PWA |
| `public/icons/*` | Icônes 192, 512, maskable 512, apple-touch 180 |
| `public/sw.js` | Service worker cache-first |

## Modèle

États :

- `idle` : accueil, deux grands boutons.
- `running { endTime, duration, fired }` : décompte en cours. `fired` = seuils
  déjà joués (10, 5, 4, 3, 2, 1, 0).
- `go { until }` : écran vert « GO » jusqu'à `until = endTime + 3000`.

Transitions :

| Depuis | Événement | Vers |
|---|---|---|
| tous | appui 30 / 60 | `running` (nouvel `endTime`, `fired` vidé) |
| `running` | appui sur le décompte | `idle` |
| `running` | restant ≤ 0 | `go` |
| `go` | `now ≥ until` | `idle` |

Calculs (fonctions pures dans `timer.ts`) :

- `remaining = endTime - Date.now()`
- chiffre affiché = `Math.ceil(remaining / 1000)`
- phase : `normal` (> 10 s), `warning` (≤ 10 s), `final` (≤ 5 s)
- progression anneau = `remaining / (duration * 1000)`
- seuils à déclencher : ceux franchis et pas encore dans `fired`. S'il y en a
  plusieurs (retour d'arrière-plan), on ne joue **que le dernier** et on marque
  tous les autres comme joués, pour éviter une rafale de bips.

## Étapes

### 1. Base de la page
- `lang="fr"`, titre, `viewport` avec `viewport-fit=cover`, balises
  `theme-color` et `apple-mobile-web-app-*`.
- CSS : variables de couleur par phase (fond neutre, orange, rouge, vert),
  `100dvh`, `safe-area-inset`, `touch-action: manipulation`,
  `user-select: none`, `-webkit-touch-callout: none`,
  `-webkit-tap-highlight-color: transparent`, `tabular-nums`.
- Mise en page pilotée par un attribut `data-state` / `data-phase` sur `<body>` :
  - `idle` : deux boutons plein écran (empilés en portrait, côte à côte en
    paysage).
  - `running` / `go` : zone décompte (anneau SVG + chiffre en `vmin`) qui
    occupe l'essentiel de l'écran, et bandeau compact avec 30 / 60 (en bas en
    portrait, à droite en paysage).

### 2. Logique du minuteur (`timer.ts`)
- Types d'état, transitions et calculs ci-dessus, sans accès au DOM ni à
  l'audio, pour pouvoir les raisonner et tester isolément.

### 3. Boucle d'affichage (`index.astro`)
- `pointerdown` sur 30 / 60 → `start(duration)` ; sur la zone décompte →
  `cancel()`.
- Boucle `requestAnimationFrame` active seulement en `running` / `go` :
  met à jour le chiffre (uniquement s'il change), l'anneau
  (`stroke-dashoffset`, en continu), la phase et l'état ; déclenche les sons.
- Animation « pulse » CSS relancée à chaque changement de chiffre en phase
  `final`.
- Au même moment, animation CSS de clignotement léger du fond (éclaircissement
  ~200 ms, par ex. `filter: brightness()` ou calque semi-transparent), désactivée
  sous `prefers-reduced-motion: reduce`.

### 4. Sons (`audio.ts`)
- Réglage `soundOn` (faux par défaut), lu / écrit dans le `localStorage`
  (clé distincte de l'état du minuteur, `try/catch`).
- Bouton haut-parleur en haut à gauche (`position: fixed`, dans la
  `safe-area`), zone tactile 52 px, hors de la zone décompte (n'annule donc
  rien). Réagit au `click`. `aria-pressed` + icône barrée / non barrée.
- Activation : crée / `resume()` l'`AudioContext` et joue un bip court de
  confirmation. Coupure : `suspend()` (coupe aussi un bip en cours) et plus
  aucun son joué.
- `AudioContext` débloqué (`resume()`) sur chaque `pointerup` / `touchend` /
  `keydown` du document si `soundOn` : un `pointerdown` tactile ne débloque
  pas l'audio (cas du réglage restauré au rechargement, coupure iOS).
- Oscillateur + enveloppe de gain (pas de clic) :
  - préavis 10 s : bip moyen (~880 Hz, ~150 ms) ;
  - tic 5 → 1 : bip court (~880 Hz, ~80 ms) ;
  - GO : bip long et plus aigu (~1320 Hz, ~600 ms).
- Valeurs ajustées à l'oreille pendant le test sur tablette.

### 5. Wake Lock (`wakelock.ts`)
- Demandé au passage en `running`, libéré au retour en `idle`.
- Redemandé sur `visibilitychange` (visible) si un décompte est en cours.
- Toute erreur ou absence d'API ignorée silencieusement.

### 6. Persistance (`storage.ts`)
- Sauvegarde `{ endTime, duration }` au démarrage, effacée au retour en `idle`.
- Au chargement : `endTime` dans le futur → `running` (seuils déjà passés
  marqués joués) ; dans les 3 s passées → `go` sans son ; sinon `idle`.
- Lecture / écriture dans un `try/catch` (navigation privée).
- Sur `visibilitychange`, la boucle se recale simplement sur `endTime`.

### 7. PWA
- `manifest.webmanifest` : nom, `display: standalone`, `start_url: /`,
  couleurs, icônes.
- Icônes : un SVG source (anneau + chiffre), exporté en PNG 192 / 512 /
  maskable 512 / 180 par un script ponctuel (hors dépendances du projet).
- `sw.js` : cache versionné ; à l'installation, mise en cache de `/` et du
  manifeste ; ensuite cache-first avec mise en cache des fichiers `/_astro/*`
  au premier chargement ; suppression des anciens caches à l'activation.
- Enregistrement du service worker uniquement en production
  (`import.meta.env.PROD`) pour ne pas gêner le dev.
- **Sous-dossier GitHub Pages** : l'app est servie sous `/rest-timer/`, pas à
  la racine. Aucun chemin absolu `/…` en dur :
  - liens du manifeste, des icônes et du service worker construits avec
    `import.meta.env.BASE_URL` dans `index.astro` ;
  - dans `manifest.webmanifest`, `start_url` et `scope` à `./`, icônes en
    chemins relatifs ;
  - dans `sw.js`, URLs mises en cache relatives à son propre emplacement
    (`new URL('./', self.location)`), filtre sur `<base>/_astro/`.

### 8. Vérification
- `npm run build` sans erreur ni avertissement TypeScript.
- Dev : `astro dev --background`, contrôle dans le navigateur desktop.
- Recette sur tablette (`npm run dev -- --host`) :
  - [ ] 30 et 60 lancent le bon décompte, affichage `60` → `1`.
  - [ ] Préavis à 10 s (son + orange), tics 5 → 1 (son + rouge + pulse +
        clignotement léger),
        GO à 0 (son distinct + vert).
  - [ ] GO affiché 3 s puis retour accueil ; appui 30 / 60 pendant GO relance.
  - [ ] Appui 30 / 60 pendant un décompte : relance avec la nouvelle durée.
  - [ ] Appui sur le décompte : retour accueil, plus aucun son.
  - [ ] Premier lancement muet ; bouton son : bip de confirmation, alertes
        audibles ; recoupé : muet immédiatement ; réglage conservé au
        rechargement ; appui sur le bouton n'annule pas le décompte.
  - [ ] Anneau fluide, couleurs de phase.
  - [ ] Portrait et paysage corrects, pas de zoom ni de sélection au tap.
  - [ ] Onglet masqué puis réaffiché : décompte juste, pas de rafale de bips.
  - [ ] Rechargement en plein décompte : reprise au bon endroit.
- Wake Lock, hors ligne et ajout à l'écran d'accueil : à vérifier sur la
  version déployée en HTTPS (étape 9).

### 9. Déploiement sur GitHub Pages
- **Dépôt** : créer le dépôt GitHub `SernaR/rest-timer`, ajouter le remote,
  renommer la branche locale `master` en `main`, pousser.
- **Config Astro** (`astro.config.mjs`) :
  `site: 'https://sernar.github.io'`, `base: '/rest-timer'` (posée dès le
  commit 5 pour tester les chemins en preview).
- **Workflow** `.github/workflows/deploy.yml` : action officielle
  `withastro/action` (build) puis `actions/deploy-pages`, déclenché à chaque
  push sur `main` et manuellement (`workflow_dispatch`).
- **Réglage GitHub** : Settings → Pages → Source : « GitHub Actions ».
- **Mises à jour** : incrémenter la version du cache dans `sw.js` à chaque
  déploiement qui modifie l'app ; la tablette récupère la nouvelle version à
  une ouverture avec réseau, active à l'ouverture suivante.
- Adresse finale : `https://sernar.github.io/rest-timer/`.
- Recette sur la version déployée :
  - [ ] Page servie en HTTPS, aucune ressource en 404 (chemins sous
        `/rest-timer/`).
  - [ ] Installation : iPad (Safari → Partager → « Sur l'écran d'accueil »)
        et Android (Chrome → « Installer l'application ») ; icône correcte,
        ouverture en plein écran.
  - [ ] Hors ligne : mode avion, l'app installée s'ouvre et fonctionne
        (sons compris).
  - [ ] Wake Lock : l'écran reste allumé pendant tout un décompte de 60 s.
  - [ ] Mise à jour : après un nouveau déploiement, la nouvelle version
        apparaît après deux ouvertures avec réseau.

## Découpage en commits

Chaque commit se termine par `npm run build` sans erreur, puis la
vérification ci-dessous (navigateur desktop via `astro dev --background`, en
mode responsive tablette, sauf mention contraire). On ne passe au commit
suivant que si elle est concluante.

1. **Base de la page et mise en page des trois états** (sans logique).
   - Vérif : en forçant `data-state` à `idle`, `running` puis `go` (outils de
     dev), chaque écran s'affiche correctement en portrait et en paysage ;
     pas de défilement, `safe-area` respectée, pas de sélection au tap.
2. **Logique du minuteur + boucle d'affichage + anneau** (étapes 2 et 3).
   - Vérif : 30 et 60 lancent le bon décompte (`60` → `1`), orange à 10 s,
     rouge + pulse + clignotement léger de 5 à 1, GO 3 s puis retour accueil ;
     relance 30 / 60 pendant un décompte et pendant GO ; appui sur le
     décompte → accueil ; anneau fluide ; pas de clignotement avec
     « réduire les animations » émulé.
3. **Sons** (bouton son compris).
   - Vérif : premier lancement muet ; activation → bip de confirmation puis
     préavis, tics et GO audibles ; coupure en plein décompte → muet
     immédiatement ; réglage conservé au rechargement ; appui sur le bouton
     son n'annule pas le décompte.
4. **Wake Lock et persistance.**
   - Vérif : rechargement en plein décompte → reprise au bon endroit, sans
     rafale de bips ; rechargement pendant GO → GO sans son ; onglet masqué
     puis réaffiché → décompte juste ; pas d'erreur console si le Wake Lock
     est absent. (Wake Lock lui-même : à confirmer après déploiement HTTPS.)
5. **PWA** (manifeste, icônes, service worker).
   - Vérif : `npm run build` + `npm run preview` : manifeste et icônes
     valides (onglet Application des outils de dev), service worker
     enregistré, page rechargée hors ligne fonctionnelle. La preview tourne
     déjà sous `/rest-timer/` (config `base` posée dès ce commit), ce qui
     valide les chemins avant le déploiement.
6. **Déploiement GitHub Pages** (workflow + config, étape 9).
   - Vérif : le workflow GitHub Actions passe au vert, l'app répond sur
     `https://sernar.github.io/rest-timer/`, puis recette de l'étape 9.

Après le commit 5 : recette complète sur tablette en local (étape 8).
Après le commit 6 : recette sur la version déployée (étape 9).
