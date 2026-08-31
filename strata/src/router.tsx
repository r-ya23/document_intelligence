import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { DocumentsPage } from "@/pages/documents-page";
import { DocumentDetailPage } from "@/pages/document-detail-page";
import { QueryPage } from "@/pages/query-page";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { NotFoundPage } from "@/pages/not-found-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    // Layout-level fallback: catches errors thrown during AppLayout's own render (rare). Errors
    // inside child routes are caught by each child's own errorElement below instead, so the nav
    // in AppLayout stays visible rather than being replaced along with the crashed page.
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DocumentsPage />, errorElement: <RouteErrorBoundary /> },
      {
        path: "documents/:documentId",
        element: <DocumentDetailPage />,
        errorElement: <RouteErrorBoundary />,
      },
      { path: "query", element: <QueryPage />, errorElement: <RouteErrorBoundary /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
