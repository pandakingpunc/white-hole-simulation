# White Hole · 3D Spacetime Simulation

A white hole is a black hole run backwards in time: nothing can get in, matter and light only pour out. This is an interactive 3D take on that idea. You can watch a disk of matter spiral outwards, throw asteroids at the horizon and see them get hurled back red-hot, or set off a burst. It runs in the browser and is built with React, TypeScript, three.js, Vite and Tailwind. English and Turkish (TR | EN toggle in the header).

**Live demo:** https://pandakingpunc.github.io/white-hole-simulation/

![White hole simulation](screenshots/white-hole.png)

## What you can do

- **Throw asteroids** (Space): gravity pulls them in, the outflow heats them up and throws them back before they ever reach the horizon.
- **Trigger a burst** (B): a sudden release of matter and energy with expanding shock shells.
- **Tune the scene:** outflow speed, rotation (spin), time flow, brightness (bloom), gravitational lensing strength and particle count (10K–160K).
- **Toggle** polar jets, periodic shock waves and auto-rotation.
- **Camera presets:** top, side and close-up views, or orbit freely with the mouse.
- **Read the info panel** for a short explanation of white holes and how they differ from black holes.

## What is on screen

- **The glowing centre** stands for the past event horizon, the surface nothing can cross from outside.
- **The matter disk** streams outwards in spiral arms and cools as it goes, from blue-white through yellow to deep red.
- **Polar jets** carry matter out along the spin axis.
- **Shock waves** leave the centre at regular intervals.
- **Gravitational lensing** bends the background stars and nebulae around the centre (a screen-space approximation).

### Simplifications

- This is a visual interpretation, not a general-relativity solver. Particle orbits, the outflow and the lensing are stylised.
- Asteroids feel a Newtonian 1/r² pull plus an outward pressure from the flow, which is what stops them at the horizon.
- No white hole has ever been observed. They are allowed by the mathematics of general relativity but are not known to exist.

For a physically traced black hole, see the companion project [Kerr Black Hole](https://github.com/pandakingpunc/kerr-black-hole), a real-time GR ray tracer.

## Fixes over the first version

The first version was generated with Claude Opus 5.5 (high effort) on arena.ai. It was then reviewed, tested and fixed with [Claude Code](https://claude.com/claude-code):

- **Brightness washed out the whole frame.** The default bloom was 1.25 and anything above about 0.3 turned the screen white, because the additive particle disk is far brighter than 1.0 in HDR. Bloom now starts at 0 and the slider is mapped onto the usable range.
- **Black hole mode removed.** The time-reversed mode duplicated what Kerr Black Hole already does, and did it less well.
- **Asteroids split into shards up close.** Each corner of the rock was scaled separately, so its faces came apart. Corners are now shared, and the rocks are lit by the white hole.
- **Mobile:** the control panel covered most of the scene and overlapped the buttons. It now starts closed on phones, and portrait screens get a wider field of view.
- **Smaller fixes:** burst follow-up shells now run on simulation time (they paused with time flow and could fire after the scene was torn down), zero-size framebuffer errors on the first frame, deprecated `THREE.Clock`, missing material and texture cleanup, Escape now closes the info panel.
- **English** was added next to Turkish.

## Run

```bash
npm install
npm run dev
```

To build:

```bash
npm run build
```

This produces a single self-contained `dist/index.html` that you can open directly in a browser.

## Controls

| Input | Action |
| --- | --- |
| Drag / scroll / right-drag | Orbit / zoom / pan |
| Space | Throw an asteroid |
| B | Burst |
| H | Show / hide the control panel |
| Esc | Close the info panel |

Add `?lang=tr` or `?lang=en` to the URL to open in a given language. Otherwise the browser language decides, and the choice is remembered.

## Türkçe

Beyaz delik, zamanda geriye oynatılan bir kara deliktir: içine hiçbir şey giremez, yalnızca madde ve ışık fışkırır. Bu proje o fikrin tarayıcıda çalışan interaktif 3D bir yorumu. Dışarı doğru sarmallanan madde diskini izleyebilir, ufka asteroit fırlatıp akkor halinde geri savrulmasını görebilir ya da bir patlama başlatabilirsin. Arayüz Türkçe ve İngilizce; sağ üstteki TR | EN düğmesiyle dil değişir, seçimin tarayıcıda hatırlanır. Tuşlar: Boşluk asteroit fırlatır, B patlama, H paneli gizler.

## Author

Mustafa Karatüm · ORCID [0009-0006-7053-2872](https://orcid.org/0009-0006-7053-2872)

## Citation

Citation metadata is in [CITATION.cff](CITATION.cff) (GitHub shows a "Cite this repository" button).

## License

[MIT](LICENSE) © 2026 Mustafa Karatüm
