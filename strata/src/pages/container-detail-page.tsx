import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContainer, useExtractions } from "@/features/containers/use-containers";
import { ExtractionsLogTable } from "@/components/containers/extractions-log-table";
import { ContainerQueryPanel } from "@/components/containers/container-query-panel";

export function ContainerDetailPage() {
  const { containerId } = useParams<{ containerId: string }>();
  const container = useContainer(containerId);
  const extractions = useExtractions(containerId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "query" ? "query" : "extractions";

  if (!container) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Container not found.</p>
        <Button variant="outline" asChild>
          <Link to="/">Back to containers</Link>
        </Button>
      </div>
    );
  }

  const totalDocs = extractions.reduce((sum, e) => sum + e.docCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{container.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalDocs} documents · {extractions.length} extraction
              {extractions.length !== 1 ? "s" : ""} · default {container.defaultMode} verify
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/containers/${container.id}/new-extraction`)}>
          <PlusIcon className="size-4" />
          New extraction
        </Button>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="extractions">Extractions</TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
        </TabsList>
        <TabsContent value="extractions" className="mt-4">
          <ExtractionsLogTable extractions={extractions} docType={container.docType} />
        </TabsContent>
        <TabsContent value="query" className="mt-4">
          <ContainerQueryPanel container={container} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
