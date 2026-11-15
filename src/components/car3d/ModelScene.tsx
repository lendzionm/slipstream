// The detailed 3D car: "f1 2026" by MattDoesBlender (Sketchfab), CC BY-NC-SA 4.0.
// We load the model file, paint it in Slipstream's carbon & red, and group its pieces
// into 6 parts you can tap, pull apart (exploded view) and, for the wings, move.
import { Asset } from "expo-asset";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PartId } from "@/content/carParts";
import type { View3D } from "./CarScene";
import { useFrame, useLoader } from "./fiber";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_FILE = require("../../../assets/models/f1_2026.glb");

export type ModelSceneProps = {
  view: { current: View3D };
  selected: PartId | null;
  exploded: boolean;
  straightMode: boolean;
  tyreColor: string;
  autoRotate: boolean;
  onSelect: (part: PartId) => void;
  onLoaded?: () => void;
};

// ---- Our paint job, by the model's material names ----
type Paint = { color: string; metal?: number; rough?: number; glow?: string; see?: number; hide?: boolean };
const RED: Paint = { color: "#CC1F2D", metal: 0.35, rough: 0.35 };
const CARBON: Paint = { color: "#17171C", metal: 0.4, rough: 0.5 };
const BLACK: Paint = { color: "#0C0C0F", metal: 0.1, rough: 0.8 };
const PAINT: Record<string, Paint> = {
  chasis: RED,
  chassis2: CARBON,
  carbon: CARBON,
  redbull_detail: { color: "#E9E9EE", metal: 0.2, rough: 0.4 }, // white accents
  mirrors: RED,
  NEGRO: BLACK,
  BLACK,
  sw_plastic_black: BLACK,
  cockpit_black_s: BLACK,
  TIRE_TREAD: { color: "#101012", metal: 0, rough: 0.95 },
  TIRE_SIDES: { color: "#101012", metal: 0, rough: 0.9 }, // recoloured by tyre compound
  redbull_wheel_hub: { color: "#2B2B33", metal: 0.85, rough: 0.3 },
  discs: { color: "#5C5C66", metal: 0.6, rough: 0.5 },
  generics: { color: "#2A2A31", metal: 0.5, rough: 0.5 },
  cockpit: { color: "#1E1E24", metal: 0.2, rough: 0.7 },
  cockpit_foam: { color: "#26262D", metal: 0, rough: 0.9 },
  cockpit_metal: { color: "#8A8A96", metal: 0.8, rough: 0.35 },
  chrome: { color: "#B9B9C4", metal: 1, rough: 0.2 },
  glass: { color: "#9AA4B5", metal: 0.1, rough: 0.05, see: 0.35 },
  rear_light: { color: "#FF3B3B", glow: "#FF3B3B" },
  rtt_light: { color: "#FF3B3B", glow: "#FF3B3B" },
  decal: { color: "#000000", hide: true },
};

// ---- Which model pieces belong to which part (top-level node names) ----
const PART_OF: Record<string, PartId> = {
  Plane_002: "frontWing", Plane_004: "frontWing", modez: "frontWing", Plane_010: "frontWing",
  Plane_005: "rearWing", modex: "rearWing", rearendplates: "rearWing", Cube_002: "rearWing",
  Rain_Lights: "rearWing", Rain_Lights2: "rearWing", Rain_Lights3: "rearWing",
  WHEEL_LF: "wheels", WHEEL_RF: "wheels", WHEEL_LR: "wheels", WHEEL_RR: "wheels",
  SUSP_LF: "suspension", SUSP_RF: "suspension", SUSP_LR: "suspension", SUSP_RR: "suspension",
  SUS_WBTOP_LF: "suspension", SUS_WBTOP_RF: "suspension", SUS_WBBOT_LF: "suspension",
  SUS_WBBOT_RF: "suspension", SUS_ROD_LF: "suspension", SUS_ROD_RF: "suspension",
  susp3: "suspension", susp4: "suspension",
  Cube: "body", Plane_018: "body", safetycell_016: "body",
};
const partOfName = (name: string): PartId => PART_OF[name] ?? "cockpit";

// Exploded view: how far each part moves, in metres, in the car's own frame
// (z = forward, y = up, x = sideways; "side" = away from the car's centre line).
const EXPLODE: Record<PartId, { x?: number; y?: number; z?: number; side?: number }> = {
  frontWing: { z: 0.9 },
  rearWing: { z: -0.8, y: 0.35 },
  wheels: { side: 0.6 },
  suspension: { side: 0.3 },
  cockpit: { y: 0.6 },
  body: {},
};

const CAR_LENGTH = 5; // display length in scene units

type Movable = { obj: THREE.Object3D; base: THREE.Vector3; delta: THREE.Vector3; part: PartId };
type Flap = { pivot: THREE.Object3D; cornerAngle: number; straightAngle: number };

function useCarModel() {
  const uri = useMemo(() => Asset.fromModule(MODEL_FILE).uri, []);
  const gltf = useLoader(GLTFLoader, uri);

  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    const materialsByPart = new Map<PartId, THREE.MeshStandardMaterial[]>();
    const tyreSides: THREE.MeshStandardMaterial[] = [];

    // Scale the car to CAR_LENGTH, centre it, put the wheels on the ground.
    const inner = new THREE.Group();
    inner.add(scene);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = CAR_LENGTH / size.z;
    scene.position.set(-centre.x, -box.min.y, -centre.z);
    inner.scale.setScalar(scale);
    inner.updateMatrixWorld(true);

    const root = scene.getObjectByName("RootNode") ?? scene;

    // Moving wing flaps: wrap each in a pivot at its leading edge.
    const flaps: Flap[] = [];
    for (const [name, cornerAngle, straightAngle] of [
      // Positive angle = the flap's back edge goes up = steeper = more downforce.
      // (Checked by measuring the flaps in the browser.)
      ["modez", 0, -0.22], // front flaps: modelled in corner mode; flatten for straights
      ["modex", 0.4, 0], // rear flap: modelled in straight mode; steepen for corners
    ] as const) {
      const flap = root.getObjectByName(name);
      if (!flap || !flap.parent) continue;
      const fb = new THREE.Box3().setFromObject(flap);
      const hinge = new THREE.Vector3((fb.min.x + fb.max.x) / 2, (fb.min.y + fb.max.y) / 2, fb.max.z);
      const pivot = new THREE.Group();
      pivot.name = `${name}_pivot`;
      flap.parent.add(pivot);
      pivot.position.copy(flap.parent.worldToLocal(hinge.clone()));
      pivot.updateMatrixWorld(true);
      pivot.attach(flap); // keeps the flap exactly where it was
      flaps.push({ pivot, cornerAngle, straightAngle });
    }

    inner.updateMatrixWorld(true);

    // Paint and group materials by part; work out exploded-view movement.
    const movables: Movable[] = [];
    for (const top of [...root.children]) {
      const name = top.name.endsWith("_pivot") ? top.name.replace("_pivot", "") : top.name;
      const part = partOfName(name);
      top.userData.part = part;

      top.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const old = mesh.material as THREE.Material;
        const paint = PAINT[old.name] ?? CARBON;
        if (paint.hide) {
          mesh.visible = false;
          return;
        }
        const m = new THREE.MeshStandardMaterial({
          color: paint.color,
          metalness: paint.metal ?? 0.3,
          roughness: paint.rough ?? 0.5,
          transparent: paint.see !== undefined,
          opacity: paint.see ?? 1,
        });
        if (paint.glow) m.emissive.set(paint.glow);
        m.userData.baseGlow = paint.glow ? 0.8 : 0;
        m.emissiveIntensity = m.userData.baseGlow;
        mesh.material = m;
        if (old.name === "TIRE_SIDES") tyreSides.push(m);
        const list = materialsByPart.get(part) ?? [];
        list.push(m);
        materialsByPart.set(part, list);
      });

      const e = EXPLODE[part];
      const wp = top.getWorldPosition(new THREE.Vector3());
      const box2 = new THREE.Box3().setFromObject(top);
      const side = Math.sign((box2.min.x + box2.max.x) / 2) || 1;
      const offset = new THREE.Vector3(
        (e.x ?? 0) + (e.side ?? 0) * side,
        e.y ?? 0,
        e.z ?? 0,
      ); // the displayed car is ~5 m long, so 1 scene unit ≈ 1 metre
      const parent = top.parent as THREE.Object3D;
      const a = parent.worldToLocal(wp.clone());
      const b = parent.worldToLocal(wp.clone().add(offset));
      movables.push({ obj: top, base: top.position.clone(), delta: b.sub(a), part });
    }

    // Final orientation: our scenes use +x as "forward"; the model's nose points +z.
    const outer = new THREE.Group();
    outer.rotation.y = Math.PI / 2;
    outer.add(inner);

    // Developer-only: lets us measure the flaps from the browser console while testing.
    if (__DEV__ && typeof window !== "undefined") {
      (window as unknown as { __slipstreamFlaps?: Flap[] }).__slipstreamFlaps = flaps;
    }

    return { outer, movables, flaps, materialsByPart, tyreSides };
  }, [gltf]);
}

export function ModelScene(p: ModelSceneProps) {
  const car = useRef<THREE.Group>(null);
  const model = useCarModel();
  const explodeAmount = useRef(0);

  useEffect(() => {
    p.onLoaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const m of model.tyreSides) m.color.set(p.tyreColor);
  }, [model, p.tyreColor]);

  useFrame((state, delta) => {
    const v = p.view.current;
    if (p.autoRotate) v.rotationY += delta * 0.35;
    if (car.current) {
      car.current.rotation.y = v.rotationY;
      car.current.rotation.x = v.rotationX;
    }
    const d = v.distance;
    state.camera.position.set(d * 0.75, d * 0.42, d * 0.75);
    state.camera.lookAt(0, 0.35, 0);

    // exploded view (eased)
    explodeAmount.current += ((p.exploded ? 1 : 0) - explodeAmount.current) * 0.12;
    for (const m of model.movables) {
      m.obj.position.copy(m.base).addScaledVector(m.delta, explodeAmount.current);
    }
    // wing flaps (eased)
    for (const f of model.flaps) {
      const target = p.straightMode ? f.straightAngle : f.cornerAngle;
      f.pivot.rotation.x += (target - f.pivot.rotation.x) * 0.15;
    }
    // highlight the selected part
    for (const [part, mats] of model.materialsByPart) {
      const on = part === p.selected;
      for (const m of mats) {
        const target = on ? 0.5 : m.userData.baseGlow;
        if (on) m.emissive.set("#FF3B3B");
        m.emissiveIntensity += (target - m.emissiveIntensity) * 0.2;
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.8} />
      <directionalLight position={[-6, 3, -4]} intensity={0.9} color="#FF3B3B" />
      <directionalLight position={[0, 4, -8]} intensity={0.6} />
      <gridHelper args={[14, 28, "#2A2A31", "#1E1E24"]} position={[0, -0.01, 0]} />
      <group ref={car}>
        <primitive
          object={model.outer}
          onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
            e.stopPropagation();
            let o: THREE.Object3D | null = e.object;
            while (o && !o.userData.part) o = o.parent;
            if (o) p.onSelect(o.userData.part as PartId);
          }}
        />
      </group>
    </>
  );
}
