import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Rect,
  Skia,
} from "@shopify/react-native-skia";
import type { MotionDoc, Shape } from "./schema";
import { MotionRuntime, type ResolvedScene, type ResolvedShape } from "./runtime";

export interface CustomMotionViewRef {
  /** Set a boolean/number input; transitions are evaluated immediately. */
  setInput(name: string, value: boolean | number): void;
  /** Fire a momentary trigger input. */
  fireTrigger(name: string): void;
  play(): void;
  pause(): void;
}

export interface CustomMotionViewProps {
  /** A parsed .motion document (e.g. require('./foo.motion.json')). */
  source: MotionDoc;
  style?: ViewStyle;
  autoPlay?: boolean;
}

// Scale/rotation pivot for a shape, given its resolved transform.
//   rectangle → center (x,y is top-left)
//   circle    → center (x,y IS the center)
//   path      → local origin (x,y)
function pivot(shape: Shape, r: ResolvedShape): { x: number; y: number } {
  if (shape.type === "rectangle") {
    return { x: r.x + (shape.width ?? 0) / 2, y: r.y + (shape.height ?? 0) / 2 };
  }
  return { x: r.x, y: r.y };
}

const ShapeNode: React.FC<{ shape: Shape; r: ResolvedShape }> = ({ shape, r }) => {
  // Hooks must run unconditionally — build the SkPath every render (memoized on `d`).
  const skPath = useMemo(
    () =>
      shape.type === "path" && shape.d ? Skia.Path.MakeFromSVGString(shape.d) : null,
    [shape.type, shape.d],
  );

  const p = pivot(shape, r);
  const transform = [
    { rotate: (r.rotation * Math.PI) / 180 },
    { scaleX: r.scaleX },
    { scaleY: r.scaleY },
  ];

  let node: React.ReactNode = null;
  if (shape.type === "rectangle") {
    node = (
      <Rect
        x={r.x}
        y={r.y}
        width={shape.width ?? 0}
        height={shape.height ?? 0}
        color={r.fill}
      />
    );
  } else if (shape.type === "circle") {
    node = <Circle cx={r.x} cy={r.y} r={shape.radius ?? 0} color={r.fill} />;
  } else if (skPath) {
    node = (
      <Group transform={[{ translateX: r.x }, { translateY: r.y }]}>
        <Path path={skPath} color={r.fill} />
      </Group>
    );
  }

  return (
    <Group origin={p} transform={transform} opacity={r.opacity}>
      {node}
    </Group>
  );
};

/**
 * Drops a .motion document onto a hardware-accelerated Skia canvas and drives it
 * with live inputs via a ref. The whole base coordinate space is scaled to fit the
 * view (letterboxed, centered).
 *
 *   const ref = useRef<CustomMotionViewRef>(null);
 *   <CustomMotionView ref={ref} source={require('./x.motion.json')} style={{width,height}} />
 *   ref.current?.setInput('isPressed', true);
 */
export const CustomMotionView = forwardRef<CustomMotionViewRef, CustomMotionViewProps>(
  ({ source, style, autoPlay = true }, ref) => {
    const runtime = useMemo(() => new MotionRuntime(source, autoPlay), [source, autoPlay]);
    const [scene, setScene] = useState<ResolvedScene>(() => runtime.resolve());
    const [size, setSize] = useState({ width: 0, height: 0 });
    const lastT = useRef<number | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        setInput: (n, v) => runtime.setInput(n, v),
        fireTrigger: (n) => runtime.fireTrigger(n),
        play: () => runtime.play(),
        pause: () => runtime.pause(),
      }),
      [runtime],
    );

    // Animation loop: advance the engine and re-resolve every frame. (A reanimated /
    // Skia-clock path that keeps work off the JS thread is a planned optimization.)
    useEffect(() => {
      let raf = 0;
      lastT.current = null;
      const loop = (t: number) => {
        if (lastT.current == null) lastT.current = t;
        runtime.tick(t - lastT.current);
        lastT.current = t;
        setScene(runtime.resolve());
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [runtime]);

    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setSize({ width, height });
    };

    const { baseWidth, baseHeight } = source.meta;
    const scale =
      size.width && size.height
        ? Math.min(size.width / baseWidth, size.height / baseHeight)
        : 1;
    const offsetX = (size.width - baseWidth * scale) / 2;
    const offsetY = (size.height - baseHeight * scale) / 2;

    return (
      <Canvas style={style} onLayout={onLayout}>
        <Group transform={[{ translateX: offsetX }, { translateY: offsetY }, { scale }]}>
          {source.canvas.shapes.map((shape) => (
            <ShapeNode key={shape.id} shape={shape} r={scene[shape.id]} />
          ))}
        </Group>
      </Canvas>
    );
  },
);

CustomMotionView.displayName = "CustomMotionView";
