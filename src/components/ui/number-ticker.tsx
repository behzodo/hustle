"use client"

import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react"
import { useInView, useMotionValue, useSpring } from "motion/react"

import { cn } from "@/lib/utils"

// `prefix` is also a global HTML attribute typed as string, so the span's own
// version has to be dropped before redeclaring it as a node.
interface NumberTickerProps
  extends Omit<ComponentPropsWithoutRef<"span">, "prefix"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
  /** Applied only while the digits are still climbing. */
  activeClassName?: string
  /**
   * Currency mark or unit. Rendered inside the styled wrapper so it picks up
   * activeClassName with the digits — a green figure beside a static grey $
   * reads as a bug.
   */
  prefix?: React.ReactNode
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  activeClassName,
  prefix,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isTicking, setIsTicking] = useState(false)
  const motionValue = useMotionValue(direction === "down" ? value : startValue)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isInView) {
      timer = setTimeout(() => {
        setIsTicking(true)
        motionValue.set(direction === "down" ? startValue : value)
      }, delay * 1000)
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [motionValue, isInView, delay, value, direction, startValue])

  const target = direction === "down" ? startValue : value

  useEffect(() => {
    // The spring never reports "finished" on its own, so settling is read off
    // the value itself: once it lands inside half a displayed unit the digits
    // have stopped changing, which is the moment the highlight should drop.
    const settleWithin = 0.5 / 10 ** decimalPlaces

    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(Number(latest.toFixed(decimalPlaces)))
      }

      setIsTicking(Math.abs(latest - target) > settleWithin)
    })
  }, [springValue, decimalPlaces, target])

  // A target already at the start value never moves the spring, so nothing
  // would ever clear the highlight. Settle it up front.
  useEffect(() => {
    if (target === startValue) setIsTicking(false)
  }, [target, startValue])

  return (
    <span
      className={cn(
        // Not transition-colors: activeClassName may animate blur or opacity
        // rather than colour, and those need to be in the property list too.
        "inline-block tracking-wider text-black tabular-nums transition-[color,filter,opacity] duration-500 dark:text-white",
        className,
        isTicking && activeClassName
      )}
      {...props}
    >
      {prefix}
      {/* Its own node: the digits are written with textContent, which would
          wipe the prefix if they shared an element. */}
      <span ref={ref}>{startValue}</span>
    </span>
  )
}
