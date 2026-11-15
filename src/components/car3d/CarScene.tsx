// BACKUP CAR: our own generic open-wheel race car, built from simple 3D shapes
// (boxes, cylinders, a torus). No real team's car or livery is copied.
// Units are roughly metres. x = forward (nose points +x), y = up, z = sideways.
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "./fiber";

export type View3D = {
  rotationY: number; // drag left/right
  rotationX: number; // drag up/down
  distance: number; // camera distance (zoom)
};

// The simple built-in car has its own part names (it's used as a backup
// if the detailed 3D model can't load).
type PartId =
  | "frontWing"
  | "nose"
  | "halo"
  | "sidepods"
  | "floor"
  | "engineCover"
  | "powerUnit"
  | "rearWing"
  | "wheels";

export type SceneProps = {
  view: { current: View3D };
  selected: PartId | null;
  exploded: boolean;
  straightMode: boolean; // 2026 active aero: wings flattened on straights
  tyreColor: string;
  autoRotate: boolean;
  onSelect: (part: PartId) => void;
};

const CARBON = "#1A1A1F";
const RED = "#CC1F2D";
const WHITE = "#E9E9EE";
const RIM = "#3A3A44";

// How far each part moves in the exploded view.
const EXPLODE: Record<PartId, [number, number, number]> = {
  frontWing: [0.9, 0, 0],
  nose: [0.45, 0.1, 0],
  halo: [0, 0.6, 0],
  sidepods: [0, 0, 0], // each side moves out on its own (see below)
  floor: [0, -0.45, 0],
  engineCover: [0, 0.85, 0],
  powerUnit: [0, 0.25, 0],
  rearWing: [-0.8, 0.35, 0],
  wheels: [0, 0, 0], // each wheel moves out on its own
};

// A part = a group that eases towards its normal or exploded position
// and glows red when selected.
function Part(props: {
  id: PartId;
  selected: PartId | null;
  exploded: boolean;
  offset?: [number, number, number];
  onSelect: (p: PartId) => void;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const target = props.exploded ? props.offset ?? EXPLODE[props.id] : [0, 0, 0];
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.x += (target[0] - g.position.x) * 0.12;
    g.position.y += (target[1] - g.position.y) * 0.12;
    g.position.z += (target[2] - g.position.z) * 0.12;
    const glow = props.selected === props.id ? 0.55 : 0;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && "emissive" in m) {
        m.emissive.set("#FF3B3B");
        m.emissiveIntensity += (glow - m.emissiveIntensity) * 0.2;
      }
    });
  });
  return (
    <group
      ref={group}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        props.onSelect(props.id);
      }}
    >
      {props.children}
    </group>
  );
}

// A box with a material, positioned and rotated.
function Block(props: {
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  color: string;
  metal?: number;
}) {
  return (
    <mesh position={props.pos} rotation={props.rot ?? [0, 0, 0]}>
      <boxGeometry args={props.size} />
      <meshStandardMaterial color={props.color} metalness={props.metal ?? 0.3} roughness={0.55} />
    </mesh>
  );
}

function Wing(props: { flapAngle: number; x: number; y: number; span: number; chord: number }) {
  const flap = useRef<THREE.Group>(null);
  useFrame(() => {
    if (flap.current) flap.current.rotation.z += (props.flapAngle - flap.current.rotation.z) * 0.15;
  });
  return (
    <group position={[props.x, props.y, 0]}>
      <Block size={[props.chord, 0.03, props.span]} pos={[0, 0, 0]} color={CARBON} />
      <group ref={flap} position={[-props.chord / 2, 0.06, 0]}>
        <Block size={[props.chord * 0.7, 0.025, props.span]} pos={[-props.chord * 0.35, 0, 0]} color={RED} />
      </group>
      {/* endplates */}
      <Block size={[props.chord * 1.1, 0.18, 0.025]} pos={[-0.08, 0.06, props.span / 2]} color={WHITE} />
      <Block size={[props.chord * 1.1, 0.18, 0.025]} pos={[-0.08, 0.06, -props.span / 2]} color={WHITE} />
    </group>
  );
}

function Wheel(props: { x: number; z: number; width: number; tyreColor: string }) {
  return (
    <group position={[props.x, 0.36, props.z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.36, 0.36, props.width, 32]} />
        <meshStandardMaterial color="#111114" roughness={0.9} metalness={0} />
      </mesh>
      {/* rim on the outer face */}
      <mesh position={[0, (Math.sign(props.z) * props.width) / 2 + Math.sign(props.z) * 0.002, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.01, 24]} />
        <meshStandardMaterial color={RIM} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* compound colour ring */}
      <mesh
        position={[0, (Math.sign(props.z) * props.width) / 2 + Math.sign(props.z) * 0.004, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.3, 0.018, 8, 40]} />
        <meshStandardMaterial color={props.tyreColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function CarScene(p: SceneProps) {
  const car = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const v = p.view.current;
    if (p.autoRotate) v.rotationY += delta * 0.35;
    if (car.current) {
      car.current.rotation.y = v.rotationY;
      car.current.rotation.x = v.rotationX;
    }
    const cam = state.camera;
    const d = v.distance;
    cam.position.set(d * 0.75, d * 0.42, d * 0.75);
    cam.lookAt(0, 0.3, 0);
  });

  const common = { selected: p.selected, exploded: p.exploded, onSelect: p.onSelect };
  // Steep flaps for corners, almost flat on straights (2026 active aero).
  const rearFlap = p.straightMode ? -0.05 : -0.55;
  const frontFlap = p.straightMode ? -0.05 : -0.4;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 4]} intensity={1.6} />
      <directionalLight position={[-6, 3, -4]} intensity={0.8} color="#FF3B3B" />
      <gridHelper args={[14, 28, "#2A2A31", "#1E1E24"]} position={[0, -0.01, 0]} />

      <group ref={car}>
        <Part id="nose" {...common}>
          {/* tapered nose: a 4-sided cylinder lying along x */}
          <mesh position={[1.75, 0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.24, 1.3, 4]} />
            <meshStandardMaterial color={RED} metalness={0.3} roughness={0.5} />
          </mesh>
        </Part>

        <Part id="frontWing" {...common}>
          <Wing x={2.55} y={0.12} span={1.75} chord={0.4} flapAngle={frontFlap} />
        </Part>

        {/* monocoque / cockpit: the car's core, it stays in place in the exploded view */}
        <Block size={[1.9, 0.5, 0.62]} pos={[0.3, 0.42, 0]} color={CARBON} />
        {/* driver's helmet */}
        <mesh position={[0.35, 0.78, 0]}>
          <sphereGeometry args={[0.13, 24, 16]} />
          <meshStandardMaterial color={WHITE} metalness={0.2} roughness={0.35} />
        </mesh>

        <Part id="halo" {...common}>
          {/* ring around the driver's head + a central strut at the front */}
          <mesh position={[0.4, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.03, 10, 40]} />
            <meshStandardMaterial color={CARBON} metalness={0.6} roughness={0.4} />
          </mesh>
          <Block size={[0.05, 0.3, 0.05]} pos={[0.76, 0.76, 0]} rot={[0, 0, 0.6]} color={CARBON} />
        </Part>

        <Part id="sidepods" {...common} offset={[0, 0, 0]}>
          <Part id="sidepods" {...common} offset={[0, 0, 0.55]}>
            <Block size={[1.5, 0.42, 0.38]} pos={[-0.35, 0.38, 0.52]} color={CARBON} />
            <Block size={[1.0, 0.06, 0.39]} pos={[-0.2, 0.6, 0.52]} color={RED} />
          </Part>
          <Part id="sidepods" {...common} offset={[0, 0, -0.55]}>
            <Block size={[1.5, 0.42, 0.38]} pos={[-0.35, 0.38, -0.52]} color={CARBON} />
            <Block size={[1.0, 0.06, 0.39]} pos={[-0.2, 0.6, -0.52]} color={RED} />
          </Part>
        </Part>

        <Part id="floor" {...common}>
          <Block size={[3.4, 0.04, 1.5]} pos={[-0.3, 0.1, 0]} color="#101013" />
          {/* diffuser: angled up at the back */}
          <Block size={[0.6, 0.04, 1.1]} pos={[-2.15, 0.2, 0]} rot={[0, 0, -0.35]} color="#101013" />
        </Part>

        <Part id="powerUnit" {...common}>
          {/* engine block + battery, normally hidden under the cover */}
          <Block size={[0.9, 0.36, 0.42]} pos={[-0.95, 0.45, 0]} color="#5A5A66" metal={0.85} />
          <Block size={[0.35, 0.2, 0.3]} pos={[-0.3, 0.3, 0]} color="#FFB020" metal={0.4} />
        </Part>

        <Part id="engineCover" {...common}>
          <mesh position={[-0.85, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.34, 1.7, 4]} />
            <meshStandardMaterial color={CARBON} metalness={0.3} roughness={0.55} />
          </mesh>
          {/* airbox above the driver */}
          <Block size={[0.4, 0.3, 0.26]} pos={[-0.05, 0.88, 0]} color={RED} />
          {/* fin */}
          <Block size={[1.1, 0.25, 0.02]} pos={[-1.2, 0.85, 0]} color={WHITE} />
        </Part>

        <Part id="rearWing" {...common}>
          <Wing x={-2.2} y={0.95} span={0.95} chord={0.32} flapAngle={rearFlap} />
          <Block size={[0.06, 0.55, 0.05]} pos={[-2.15, 0.65, 0]} color={CARBON} />
        </Part>

        <Part id="wheels" {...common}>
          {(
            [
              [1.6, 0.8, 0.3],
              [1.6, -0.8, 0.3],
              [-1.55, 0.8, 0.38],
              [-1.55, -0.8, 0.38],
            ] as const
          ).map(([x, z, w]) => (
            <Part key={`${x}${z}`} id="wheels" {...common} offset={[0, 0, Math.sign(z) * 0.5]}>
              <Wheel x={x} z={z} width={w} tyreColor={p.tyreColor} />
            </Part>
          ))}
        </Part>
      </group>
    </>
  );
}
