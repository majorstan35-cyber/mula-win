import { Link } from "@tanstack/react-router";

export function TermsFooter() {
  return (
    <footer className="mt-12 text-center text-[10px] leading-relaxed text-[color:var(--muted-foreground)] py-6">
      <p>18+</p>
      <p className="mt-1">
        <Link to="/terms" className="underline hover:text-[color:var(--foreground)] transition-colors">
          Terms & Conditions
        </Link>
      </p>
      <p className="mt-1">Enjoy and have fun with Mula.</p>
    </footer>
  );
}
