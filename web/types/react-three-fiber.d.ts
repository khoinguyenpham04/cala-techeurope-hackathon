import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {
      /** Sentinel so this augmentation is not an empty interface. */
      "r3f-intrinsic"?: never;
    }
  }
}

export {};
