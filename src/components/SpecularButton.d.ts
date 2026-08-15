import type { ButtonHTMLAttributes, ReactNode } from "react";

// SpecularButton ships as .jsx, so TypeScript infers each prop from its
// default value — `children` came out as `string` because the default is
// "Get Started", which rejects an icon. These are the real types.
export interface SpecularButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
}

declare const SpecularButton: (props: SpecularButtonProps) => JSX.Element;

export default SpecularButton;
