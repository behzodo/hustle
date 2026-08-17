import { useEffect, useState } from "react";

/**
 * False through the server render and the first client render, true after.
 *
 * The gate for anything whose *markup* depends on something the server cannot
 * know — the resolved theme, WebGL support, the viewport. next-themes is the
 * usual culprit: it reads localStorage synchronously, so a component that
 * branches on the theme renders one thing on the server and a different thing
 * on the very first client pass, which is exactly what React reports as a
 * hydration mismatch.
 */
export const useMounted = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted;
};
