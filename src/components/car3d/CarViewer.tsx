// The 3D view: a canvas with the car, plus drag-to-rotate (works with a mouse
// in the browser and with a finger on the phone).
// Shows the detailed model; if it can't load, falls back to our simple built-in car.
import { Component, ReactNode, Suspense, useRef } from "react";
import { PanResponder, View } from "react-native";
import { CarScene, View3D } from "./CarScene";
import { Canvas } from "./fiber";
import { ModelScene, ModelSceneProps } from "./ModelScene";

type Props = ModelSceneProps & { height: number; onFailed?: () => void };

// If loading the model throws an error, show the simple car instead.
class ModelErrorBoundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CarViewer({ height, onFailed, ...scene }: Props) {
  const start = useRef({ x: 0, y: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // plain taps go to the 3D parts
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        start.current = { x: scene.view.current.rotationY, y: scene.view.current.rotationX };
      },
      onPanResponderMove: (_e, g) => {
        scene.view.current.rotationY = start.current.x + g.dx * 0.01;
        scene.view.current.rotationX = Math.max(-0.5, Math.min(0.6, start.current.y + g.dy * 0.005));
      },
    }),
  ).current;

  const backup = (
    <CarScene
      view={scene.view as { current: View3D }}
      selected={null}
      exploded={scene.exploded}
      straightMode={scene.straightMode}
      tyreColor={scene.tyreColor}
      autoRotate={scene.autoRotate}
      onSelect={() => {}}
    />
  );

  return (
    <View style={{ height, borderRadius: 14, overflow: "hidden" }} {...pan.panHandlers}>
      <Canvas camera={{ fov: 40, position: [5, 2.5, 5] }} style={{ flex: 1 }}>
        <color attach="background" args={["#0E0E11"]} />
        <ModelErrorBoundary fallback={backup} onError={onFailed}>
          <Suspense fallback={null}>
            <ModelScene {...scene} />
          </Suspense>
        </ModelErrorBoundary>
      </Canvas>
    </View>
  );
}
