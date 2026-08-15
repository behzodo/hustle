import Link from "next/link";

import { Logo } from "@/components/logo";
import Footer from "@/components/footer-2";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="@container overflow-x-hidden">
      <header className="mx-auto max-w-3xl px-6 pt-10">
        <Link
          href="/"
          aria-label="Hustle home"
        >
          <Logo />
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_li]:mb-2 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>

      <Footer />
    </main>
  );
};

export default Layout;
