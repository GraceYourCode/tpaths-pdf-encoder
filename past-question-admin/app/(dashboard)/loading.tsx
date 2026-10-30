import { Spinner } from "@/components/ui/spinner";

/** Route-level Suspense fallback for dashboard pages. */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
      <Spinner className="h-6 w-6" label="Loading" />
    </div>
  );
}
