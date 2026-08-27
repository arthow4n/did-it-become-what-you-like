import { createTheme, MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";

type ColorTuple = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  ...string[],
];

function semanticColor(token: string): ColorTuple {
  return Array.from(
    { length: 10 },
    () => `var(--color-${token})`,
  ) as unknown as ColorTuple;
}

const semanticSpacing = Object.fromEntries(
  Array.from(
    { length: 10 },
    (_, index) => [`ds-${index + 1}`, `var(--space-${index + 1})`],
  ),
) as Record<string, string>;

const semanticCssVariables = () => ({
  variables: {
    "--mantine-control-height": "var(--control-height)",
    "--mantine-z-index-app": "var(--layer-content)",
    "--mantine-z-index-modal": "var(--layer-overlay)",
    "--mantine-z-index-popover": "var(--layer-overlay)",
    "--mantine-z-index-overlay": "var(--layer-overlay)",
    "--mantine-z-index-max": "var(--layer-toast)",
    "--mantine-motion-immediate": "var(--motion-immediate)",
    "--mantine-transition-duration": "var(--motion-immediate)",
  },
  light: {},
  dark: {},
});

const afterMidnightTheme = createTheme({
  primaryColor: "accent",
  primaryShade: 0,
  fontFamily: "var(--font-family-ui)",
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSizes: {
    xs: "var(--font-size-caption)",
    sm: "var(--font-size-label)",
    md: "var(--font-size-body)",
    lg: "var(--font-size-title)",
    xl: "var(--font-size-display)",
  },
  lineHeights: {
    xs: "var(--line-height-tight)",
    sm: "var(--line-height-tight)",
    md: "var(--line-height-body)",
    lg: "var(--line-height-tight)",
    xl: "var(--line-height-tight)",
  },
  fontWeights: {
    regular: "400",
    medium: "650",
    bold: "700",
  },
  headings: {
    fontFamily: "var(--font-family-ui)",
    fontWeight: "700",
    textWrap: "wrap",
    sizes: {
      h1: {
        fontSize: "var(--font-size-display)",
        lineHeight: "var(--line-height-tight)",
      },
      h2: {
        fontSize: "var(--font-size-title)",
        lineHeight: "var(--line-height-tight)",
      },
      h3: {
        fontSize: "var(--font-size-body)",
        lineHeight: "var(--line-height-tight)",
      },
      h4: {
        fontSize: "var(--font-size-body)",
        lineHeight: "var(--line-height-tight)",
      },
      h5: {
        fontSize: "var(--font-size-label)",
        lineHeight: "var(--line-height-tight)",
      },
      h6: {
        fontSize: "var(--font-size-label)",
        lineHeight: "var(--line-height-tight)",
      },
    },
  },
  spacing: {
    xs: "var(--space-1)",
    sm: "var(--space-2)",
    md: "var(--space-3)",
    lg: "var(--space-4)",
    xl: "var(--space-6)",
    ...semanticSpacing,
  },
  radius: {
    xs: "var(--radius-control)",
    sm: "var(--radius-control)",
    md: "var(--radius-card)",
    lg: "var(--radius-overlay)",
    xl: "var(--radius-pill)",
  },
  defaultRadius: "sm",
  shadows: {
    xs: "none",
    sm: "none",
    md: "var(--shadow-overlay)",
    lg: "var(--shadow-overlay)",
    xl: "var(--shadow-overlay)",
  },
  breakpoints: {
    xs: "22.5em",
    sm: "45em",
    md: "64em",
    lg: "75em",
    xl: "90em",
  },
  colors: {
    canvas: semanticColor("canvas"),
    surface1: semanticColor("surface-1"),
    surface2: semanticColor("surface-2"),
    surface3: semanticColor("surface-3"),
    borderSubtle: semanticColor("border-subtle"),
    borderStrong: semanticColor("border-strong"),
    textPrimary: semanticColor("text-primary"),
    textSecondary: semanticColor("text-secondary"),
    textMuted: semanticColor("text-muted"),
    accent: semanticColor("accent"),
    onAccent: semanticColor("on-accent"),
    positive: semanticColor("positive"),
    negative: semanticColor("negative"),
    danger: semanticColor("danger"),
    warning: semanticColor("warning"),
    info: semanticColor("info"),
    focusRing: semanticColor("focus-ring"),
  },
  focusRing: "auto",
  cursorType: "pointer",
  respectReducedMotion: true,
  components: {
    Container: {
      defaultProps: { strategy: "block" },
    },
    Stack: {
      defaultProps: {
        gap: "ds-4",
        align: "stretch",
        justify: "flex-start",
      },
    },
    Group: {
      defaultProps: {
        gap: "ds-2",
        align: "center",
        justify: "flex-start",
        wrap: "wrap",
        preventGrowOverflow: false,
      },
    },
    SimpleGrid: {
      defaultProps: {
        spacing: "ds-4",
        type: "media",
      },
    },
    Text: {
      defaultProps: { inherit: false },
    },
    Card: {
      defaultProps: {
        padding: "ds-4",
        radius: "md",
        shadow: "none",
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
        shadow: "none",
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
        size: "md",
      },
    },
    Pill: {
      defaultProps: {
        radius: "xl",
        size: "md",
      },
    },
  },
});

export type DesignSystemProviderProps = {
  children: ReactNode;
};

export function DesignSystemProvider(
  { children }: DesignSystemProviderProps,
) {
  return (
    <MantineProvider
      theme={afterMidnightTheme}
      cssVariablesResolver={semanticCssVariables}
      forceColorScheme="dark"
      deduplicateCssVariables
    >
      {children}
    </MantineProvider>
  );
}
