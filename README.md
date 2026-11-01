# Tables de multiplication

Web app pour apprendre les tables de 1 à 10 (7–10 ans). Une séance par jour d'environ 5 minutes ; l'app choisit seule quoi travailler.

En ligne : https://remiabel.github.io/tables-multiplication/ (redéployée par GitHub Actions à chaque push sur `main`). Installable sur tablette/téléphone (« Ajouter à l'écran d'accueil »), fonctionne hors ligne après une 2e ouverture.

## Principes (issus de la recherche)

- Les faits arrivent dans un ordre qui part des tables faciles : ×1, ×10, ×2, ×5, les carrés, ×3, ×4, ×9, ×6, ×8. Chaque nouveau fait est présenté avec une image (points) et une astuce (dont « presque un carré » : 6 × 7 = 6 × 6 + 6).
- L'enfant tape la réponse de mémoire (pas de choix multiple), les faits sont mélangés ; les faits bien connus sont aussi demandés dans l'autre sens (6 × ? = 24).
- Boîtes de Leitner : juste et rapide → le fait monte d'un niveau et revient plus tard ; faux → retour au niveau 1. Le seuil « rapide » vaut 3 s, ajusté à la vitesse de l'enfant (mesurée sur ×1 et ×10), entre 3 et 5 s.
- ×1 et ×10 sont introduits 5 par séance ; ensuite 4 nouveaux faits par séance, aucun si 8 faits sont encore fragiles. Chaque nouveau fait est reposé en fin de séance.
- Pas de chrono visible ; une erreur montre la correction, nomme la confusion (« 48, c'est 6 × 8 ») et le fait revient 3 questions plus loin.
- Un petit problème illustré en fin de séance (non noté).
- Motivation sans compétition : étoiles (effort, progrès, réussite), badge par table maîtrisée, une étoile par jour joué dans la semaine, une image qui se dévoile dans la grille.
- Lecture des questions à voix haute (option sur l'accueil).

Les réglages se trouvent en haut de [src/engine.ts](src/engine.ts).

## Commandes

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # tests du moteur
npm run build   # site statique dans dist/, à servir avec n'importe quel serveur web
```

La progression est enregistrée dans le navigateur (`localStorage`) : elle est propre à chaque appareil.
