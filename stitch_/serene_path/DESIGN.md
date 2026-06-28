---
name: Serene Path
colors:
  surface: '#faf9f7'
  surface-dim: '#dadad8'
  surface-bright: '#faf9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f1'
  surface-container: '#efeeec'
  surface-container-high: '#e9e8e6'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1b'
  on-surface-variant: '#41484c'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#71787c'
  outline-variant: '#c0c7cc'
  surface-tint: '#326479'
  primary: '#2f6277'
  on-primary: '#ffffff'
  primary-container: '#4a7b90'
  on-primary-container: '#fbfdff'
  inverse-primary: '#9ccee5'
  secondary: '#44664e'
  on-secondary: '#ffffff'
  secondary-container: '#c6eccd'
  on-secondary-container: '#4a6c54'
  tertiary: '#7f5137'
  on-tertiary: '#ffffff'
  tertiary-container: '#9b694e'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bde9ff'
  primary-fixed-dim: '#9ccee5'
  on-primary-fixed: '#001f2a'
  on-primary-fixed-variant: '#154c60'
  secondary-fixed: '#c6eccd'
  secondary-fixed-dim: '#abcfb2'
  on-secondary-fixed: '#00210f'
  on-secondary-fixed-variant: '#2d4e37'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#f7b999'
  on-tertiary-fixed: '#321201'
  on-tertiary-fixed-variant: '#673c24'
  background: '#faf9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e3e2e0'
typography:
  display:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is centered on the concepts of psychological safety, accessibility, and professional warmth. The target audience includes individuals seeking emotional support, often arriving at the platform in states of high cognitive load or anxiety. Consequently, the UI must act as a stabilizing force—minimizing friction and maximizing a sense of "held space."

The chosen style is a blend of **Soft Minimalism** and **Organic Professionalism**. It avoids the clinical coldness of traditional medical software by utilizing gentle gradients and rounded forms, while maintaining the reliability of a high-end SaaS product. The interface prioritizes whitespace and legible type to reduce visual noise, ensuring that the path to help is always clear and unobtrusive.

## Colors

The palette is designed to de-escalate stress through low-vibrancy, nature-inspired tones.

*   **Primary (Quiet Sea):** A muted, slate blue used for primary actions, navigation, and structural elements. It conveys stability and depth.
*   **Secondary (Sage Mist):** A soft, earthy green used for positive states, progress indicators, and health-related highlights.
*   **Tertiary (Soft Clay):** A warm, muted terracotta used sparingly for accents that require gentle attention without triggering alarm.
*   **Neutral (Canvas):** A warm white base that prevents the "starkness" of pure white (#FFFFFF), creating a softer reading experience.
*   **Surface Tones:** Use varying weights of the neutral color to define card backgrounds and page sections, maintaining a monochromatic layering effect.

## Typography

This design system utilizes **Manrope** for its exceptional balance of modern geometry and humanist warmth. Its open counters and consistent stroke weights ensure maximum readability for users who may be experiencing blurred vision or lack of focus due to stress.

*   **Headlines:** Should be set with tight letter-spacing to feel "contained" and grounded.
*   **Body Text:** Prioritize generous line-height (1.5x minimum) to create a rhythmic, breathable reading experience.
*   **Emphasis:** Avoid all-caps where possible; use font weight (600) to create hierarchy instead, as all-caps can be perceived as "shouting" in a sensitive context.

## Layout & Spacing

The layout philosophy follows a **Fluid-Fixed Hybrid**. Content is centered within a 1200px max-width container on desktop, while utilizing fluid percentages on smaller breakpoints. 

*   **Rhythm:** An 8px base grid is strictly followed. Components use 16px (2 units) or 24px (3 units) of internal padding to maintain an airy feel.
*   **Margins:** Generous outer margins are essential to prevent the UI from feeling "cramped." On mobile, a 16px margin is the minimum, though 20px is preferred for reading-heavy screens.
*   **Safe Areas:** Interaction elements (buttons, inputs) must be separated by at least 12px of vertical margin to prevent accidental taps, which can cause user frustration.

## Elevation & Depth

To maintain a calming atmosphere, depth is conveyed through **Ambient Tonal Layering** rather than harsh shadows.

*   **Shadows:** Use very low-opacity (8-12%) shadows with a large blur radius (20px+) and a slight blue-tinted offset. This creates the appearance of elements "floating" softly on a cloud-like surface.
*   **Tonal Layers:** Deepen the background color slightly for container surfaces (e.g., a Sidebar at #F2F1EE against a Body at #F9F8F6) to create hierarchy without needing borders.
*   **Glassmorphism:** Use subtle backdrop blurs (12px) for sticky headers or modal overlays to maintain a sense of context and spatial awareness, reducing the feeling of being "locked" in a screen.

## Shapes

The shape language is inherently "friendly." Sharp corners are eliminated to remove any sense of clinical rigidity.

*   **Base Components:** Buttons and input fields use a 0.5rem (8px) radius.
*   **Containers:** Cards and larger layout sections use 1rem (16px) or 1.5rem (24px) to soften the overall visual footprint.
*   **Interactive Feedback:** Use "squircle" or pill-shaped containers for status chips and notification badges to make them feel organic and tactile.

## Components

### Chat Bubbles
Bubbles should have asymmetrical rounding: the corner pointing toward the avatar should be 4px, while the other three corners are 18px.
*   **User (Self):** Primary color background with white text.
*   **Counselor:** Secondary color (Sage Mist) or a light neutral with dark text to feel approachable.

### Voice Call Interface
The interface should feature a large, centered avatar with a pulsing "breath" animation (a subtle scale and opacity shift in the background ring) to indicate active connection. Controls (Mute, End Call) should be large, circular, and clearly separated to prevent errors.

### Status Indicators
*   **Online:** A soft pulse of Sage Mist.
*   **Away:** A solid Soft Clay dot.
*   Avoid using red for "Busy" or "Offline"; use a neutral grey or muted blue to avoid triggering "emergency" associations.

### Buttons
Primary buttons use a subtle vertical gradient (Primary Color Top to a slightly darker shade Bottom) to give a tactile, "pressable" feel. Secondary buttons should be "ghost" style with a 1px border of the Primary color.

### Cards
Cards must always feature a soft shadow (see Elevation). Group information logically with wide gutters (32px) between card sections to ensure content is never overwhelming.