# Stellarium-like Night Sky Observer

This is an Angular application that renders a Stellarium-like night sky in the browser using Three.js.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## App behavior

- Renders a star dome using THREE.Points (≈16k points). Stars should be bright and always visible:
  - PointsMaterial with additive blending, depthWrite: false.
  - size: 3.0, and sizeAttenuation: false (constant pixel size).
  - Scale the points cloud to radius ~1000 and set frustumCulled = false.
  - Solid black background.
- Camera/controls:
  - PerspectiveCamera( fov=90, near=0.1, far=5000 ), placed at origin (0,0,0.01).
  - OrbitControls imported via ES modules:
      import * as THREE from "three";
      import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  - Enable rotation (look around), disable zoom & pan (Stellarium-like feel).
- HUD (vanilla HTML/CSS):
  - Sliders: Time (0–24h), Latitude (−66°..+66°), FOV (40..120°).
  - Buttons: Toggle labels, Toggle constellations, Regenerate stars.
  - Place HUD at bottom in a translucent panel; responsive.
- Astronomy logic (approximate is fine):
  - Use a single THREE.Group (skyGroup). Rotate:
      - around Y by local sidereal time proxy from “Time” slider (hour/24 * 2π).
      - around X so the pole altitude ≈ latitude (90° − lat).
- Labels:
  - A small set of bright named stars rendered as THREE.Sprite with CanvasTexture.
  - DepthTest false, depthWrite false. Scale sprites for readability.
- Constellations:
  - Include an embedded JSON of line segments for a starter set (Orion, Ursa Major/Minor, Cassiopeia, Cygnus, Lyra, Aquila, Pegasus, Andromeda, Perseus, Taurus, Gemini, Leo, Scorpius, Sagittarius, Crux, Canis Major, Carina, Centaurus, Pisces, Aries).
  - Provide a starCatalog map of {name: {ra_h, dec_d}} covering those segments.
  - Draw each segment as THREE.Line with LineBasicMaterial(color: #44aaff, opacity ~0.75, transparent: true).
- Responsiveness:
  - Resize handler updates renderer/camera aspect & size.
  - Renderer pixel ratio capped at 2.