import { Link } from "wouter";
import { Anchor, ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

export default function NotFound() {
  usePageTitle("Page Not Found");

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Anchor size={22} />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-1">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-5">
          This page has drifted off course — the link may be broken or the page may have moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
