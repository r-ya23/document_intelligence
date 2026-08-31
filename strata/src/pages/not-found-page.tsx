import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <p className="font-medium">Page not found.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Back to documents</Link>
      </Button>
    </div>
  );
}
