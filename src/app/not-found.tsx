import type { Metadata } from "next";

import { NotFoundView } from "@/components/not-found-view";

// Kept a server component so the 404 still carries metadata; the view is a
// client component only because it reads the attempted path.
export const metadata: Metadata = {
  title: "Page not found",
  description: "That page doesn't exist.",
  robots: { index: false, follow: false },
};

const NotFound = () => <NotFoundView />;

export default NotFound;
