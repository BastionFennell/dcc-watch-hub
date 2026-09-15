import type { SVGProps } from 'react';

/**
 * Five-ish inline SVG glyphs replacing the wireframe's icon font.
 * Shipping a font for eight glyphs would add a blocking request (constitution IV).
 */
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconBroadcast(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="1.5" />
      <path d="M8.7 15.3a4.7 4.7 0 0 1 0-6.6M15.3 8.7a4.7 4.7 0 0 1 0 6.6" />
      <path d="M5.9 18.1a8.7 8.7 0 0 1 0-12.2M18.1 5.9a8.7 8.7 0 0 1 0 12.2" />
    </Svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4Z" />
      <path d="M9 4v13M15 7v12.5" />
    </Svg>
  );
}

export function IconLoot(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 3.5 7.2v9.6L12 21l8.5-4.2V7.2L12 3Z" />
      <path d="M3.5 7.2 12 11.4l8.5-4.2M12 11.4V21" />
    </Svg>
  );
}

export function IconRank(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H5.5v1A3.5 3.5 0 0 0 8 9.9M16 5.5h2.5v1A3.5 3.5 0 0 1 16 9.9" />
      <path d="M12 13v3.5M9 20h6M10.5 16.5h3v3.5h-3z" />
    </Svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

/** The panel close control (v2). */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

/** "Share this moment" (004): three nodes on a line, the platform-neutral glyph. */
export function IconShare(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.4 10.8 15.7 6.6M8.4 13.2l7.3 4.2" />
    </Svg>
  );
}
