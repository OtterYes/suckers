# Astra Model Specs

Models I'll generate with Astra to replace the simple shapes. **Not needed until M3.** The app always falls back to simple shapes if a file is missing.

## Format rules (all models)
- **File:** `.glb` (glTF binary, textures embedded). Astra can export any format, so always pick `.glb` ([[Decisions]] D16).
- **Scale:** 1 unit = 1 meter. Characters about **1.7 m** tall.
- **Origin:** at the feet, centered. **Facing:** +Z (the glTF "forward").
- **Size budget:** characters ≤ 15k triangles, props ≤ 5k, area buildings ≤ 30k. Textures 1024–2048 px.
- **Style:** stylized low-poly, soft shading, no text baked into textures (the app adds labels)
- **Colors:** match each area's color ([[World Design]])
- **Animations (if Astra can rig them):** named exactly `idle`, `walk`, `work`, `celebrate`, `confused`

## Where files go
`ecosystem/assets/models/`, with these exact names:

| File | What | Notes |
|---|---|---|
| `agent_coordinator.glb` | friendly organizer, clipboard | warm white and gold |
| `agent_roblox_builder.glb` | builder with a small toolbelt | orange |
| `agent_tutor.glb` | calm teacher-type, book | blue |
| `agent_strategist.glb` | sharp, marker in hand | green |
| `agent_producer.glb` | camera or phone in hand | pink |
| `area_hq.glb` | round plaza with two big boards | ~12 m wide |
| `area_roblox_lab.glb` | workshop with a desk and a small obby model | ~10 m |
| `area_student_hub.glb` | library nook with a desk | ~10 m |
| `area_business_studio.glb` | studio with a desk and whiteboard | ~10 m |
| `area_tiktok_studio.glb` | studio with a desk, ring light, and backdrop | ~10 m |

## Sample prompt for Astra
> "Stylized low-poly 3D character, friendly robot-assistant builder, orange and cream colors, small toolbelt, about 1.7 m tall, standing in a neutral pose, origin at feet, facing forward, under 15k triangles, export as GLB with embedded textures."
