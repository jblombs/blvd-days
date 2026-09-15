# Blvd Days (3D)

Phone-friendly **Three.js** errand adventure in a stylized **Rego Park** & **Forest Hills**, Queens. Walk crowded sidewalks, cross **Queens Boulevard**, toggle **sunny / rainy** weather, and finish everyday tasks.

Not photoreal / not GTA — lit low-poly buildings, traffic, and diverse pedestrian agents you navigate around. Character and story are fictional.

## Quick start

```bash
cd app
npm install
npm run dev
```

```bash
npm run build    # → dist/
npm run preview
```

## Controls

| Input | Action |
|--------|--------|
| WASD / Arrows | Move (camera-relative) |
| E / Space | Interact |
| Virtual joystick | Move (touch) |
| **Interact** button | Interact (touch) |
| ☀️/🌧️ button | Toggle sunny ↔ rainy |

## Quests (v1)

1. **Cross Queens Blvd** — use the street and reach the gold-ring plaza marker  
2. **Bodega grocery run** — red awning shop in Rego Park  
3. **Forest Hills subway** — green-accent subway entrance plaza  

Day progress meter tracks completed errands.

## World

- West: Rego Park blocks & bodega  
- Center: Queens Blvd (lanes, median trees, crosswalks, traffic)  
- East: Forest Hills blocks & subway  
- ~50 sidewalk pedestrians with varied skin tones / clothing; some modest head coverings or kippot as simple geometry (respectful, not caricature)  
- Soft collision: walk around the crowd; buildings are solid  

## Tech

- Vite + TypeScript + Three.js (WebGL)  
- Canvas overlay UI for HUD / quests / touch  
- Shadows + fog; rain via `THREE.Points`  

## Known limits (v1)

- Stylized boxes, not scanned NYC geometry  
- No interior rooms; interact at outdoor markers  
- No save/load  
- Crowd AI is sidewalk wander + separation (not full navmesh)  
- Mobile Safari: keep pixel ratio ≤ 2; large crowds may warm the device  

## License

Personal / portfolio use. Place names are real; people and plot are fictional.
