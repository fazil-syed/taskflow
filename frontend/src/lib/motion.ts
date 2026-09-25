/**
 * Shared motion primitives. Keeping durations and easings in one place is what
 * makes the app feel like one system rather than a collection of animations.
 */
import type { Transition, Variants } from 'framer-motion'

export const EASE_OUT = [0.16, 1, 0.3, 1] as const
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const

export const DURATION = {
  fast: 0.14,
  base: 0.2,
  slow: 0.32,
} as const

export const spring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
}

export const softSpring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
}

/** A panel sliding in from the edge, used by the drawer. */
export const drawerVariants: Variants = {
  hidden: { x: '100%', opacity: 0.6 },
  visible: { x: 0, opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { x: '100%', opacity: 0.4, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
}

export const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
}

export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
}

/** Small popover menus: the project menu, the filter dropdown. */
export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.fast, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.1 } },
}

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: 8, scale: 0.97, transition: { duration: DURATION.fast } },
}

/** A card settling into a queue. */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DURATION.fast } },
}

/** The page body sliding in when the route changes. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.fast } },
}
