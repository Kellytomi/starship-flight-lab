# Starship Flight Lab

An interactive 3D model of a full Starship mission: liftoff, hot staging, the booster's return and tower catch, the ship's reentry, the landing flip and splashdown (or a tower catch). It shows the forces acting on the vehicle at every moment.

**Live:** https://starship-flight-lab.vercel.app

> An independent educational project. Not affiliated with or endorsed by SpaceX. Figures are approximate and based on public information about Block 2 vehicles and flight tests through 2025.

## What's inside

- **Flight lab (3D):** scrub or play through both chapters, *Super Heavy · launch & catch* and *Starship · space & back*.
  - **Camera views:** Chase, Overview and Turntable.
  - **Overlays:** X-ray (tanks and live propellant), Trajectory (both flight paths over the Earth) and Vectors (force arrows).
  - **Ending:** switch between an ocean splashdown and a tower catch.
- **Force balance:** thrust, gravity, drag, lift and pad/arm load, calculated from a mass and propellant model, with thrust-to-weight, air load, heat-shield temperature and telemetry.
- **Explainer:** a card for each step, with cited sources (NASA, OpenStax, Wikipedia, SpaceX) and the live equations behind the numbers.
- **Deep dives:**
  - the Raptor engine's full-flow staged combustion cycle
  - boostback and the chopstick catch, with a playable "catch it yourself" game
  - reentry, the heat shield and the flaps
- **Physics & sources:** the model and every assumption, written out.

## How it's built

A static site: vanilla JavaScript ES modules and [three.js](https://threejs.org) r160 loaded from a CDN, with no build step.

```
index.html        page shell and section markup
css/              base tokens, lab UI, deep-dive styles
js/lab/
  flight.js       trajectories, mass & propellant model, forces, phase copy and sources
  models.js       procedural Super Heavy, Starship and launch tower
  env.js          sky, sun, terrain, water, Earth, clouds
  fx.js           plumes, steam, reentry plasma, force vectors, trajectory lines
  app.js          renderer, cameras, choreography and UI
js/raptor.js, js/catch.js, js/reentry.js   deep-dive modules
assets/           NASA Blue Marble imagery (public domain)
```

## Run it locally

Any static file server works:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Credits

- Earth imagery: NASA Visible Earth, *Blue Marble* (public domain).
- 3D engine: three.js (MIT).
- Typefaces: Geist and Geist Mono (Vercel, OFL).
