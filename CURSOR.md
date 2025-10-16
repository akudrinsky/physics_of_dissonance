This repo no longer uses `CURSOR.md` for public-facing documentation.  
Head to [`/docs`](http://localhost:3000/docs) for the illustrated walkthrough of the dyadic and triad explorers.

Development tips:

- Shared math and audio helpers live in `src/lib/dissonance/`.
- When you add a new visualization, plug into the existing `useReferenceTonePlayer` so the broadcast channel keeps notes from overlapping.
- Run `npm run lint` before committing. Visual updates should keep the navigation (only Dyadic + Triad) tidy.
