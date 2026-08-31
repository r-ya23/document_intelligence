import { Link, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";

// Route-level fallback for errors React Router catches during render (including rules-of-hooks
// violations and other unexpected crashes) — replaces the framework's raw default error page with
// something the user can actually recover from via a link back to a known-good route.
export function RouteErrorBoundary() {
  const error = useRouteError();

  let message = "Something went wrong.";
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <TriangleAlertIcon className="size-8 text-destructive" />
      <div>
        <p className="font-medium">This page ran into a problem.</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild>
        <Link to="/">Back to documents</Link>
      </Button>
    </div>
  );
}
