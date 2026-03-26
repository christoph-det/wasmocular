import { useStores } from "@/store/StoreContext";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "./ui/dialog";
import { useToast } from "@/hooks/useToast";

interface LoadOtherProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for loading or deleting other projects from local storage.
 */
const LoadOtherProjectDialog = ({
  open,
  onOpenChange
}: LoadOtherProjectDialogProps) => {
  const indexingStore = useStores().indexingStore;
  const dashboardStore = useStores().dashboardStore;
  const databaseStore = useStores().dbStore;
  const wasmGixStore = useStores().wasmGixStore;

  const { showSuccess } = useToast();

  // loads the selected project and sets its dashboard as active
  const handleLoadClick = async (
    repositoryIdentifier: string | undefined,
    defaultDashboardId?: string | null
  ) => {
    await indexingStore.loadFromStorage(repositoryIdentifier);
    if (defaultDashboardId) {
      await dashboardStore.setActiveDashboard(defaultDashboardId);
    }
    onOpenChange(false);
  };

  const handleDeleteClick = async (
    repositoryIdentifier: string | undefined,
    dashboardId?: string | null
  ) => {
    if (
      !confirm(
        "Are you sure you want to delete the current project from local storage? This action cannot be undone."
      )
    ) {
      return;
    }
    if (!repositoryIdentifier) {
      alert("Cannot delete project: No project loaded/inconsistent state.");
      return;
    }

    try {
      await databaseStore.deleteDatabase(repositoryIdentifier);
      await wasmGixStore.deleteRepositroyData(repositoryIdentifier);
      if (dashboardId) {
        dashboardStore.deleteDashboard(dashboardId);
      }
      indexingStore.deleteProjectFromStorage(repositoryIdentifier);

      onOpenChange(false);
      showSuccess("Project deleted successfully.");
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project from local storage.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Other Project</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {indexingStore.listAllStoredProjects().length === 0 ||
          (indexingStore.project &&
            indexingStore.listAllStoredProjects().length === 1) ? (
            <p>No other projects found in local storage.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {indexingStore.listAllStoredProjects().map((item) => {
                // Skip current project and projects without identifier
                const isCurrentProject = item.project?.repositoryIdentifier ===
                    indexingStore.project?.repositoryIdentifier;
                return (
                  <div
                    key={item.project?.repositoryIdentifier}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border border-gray-200 rounded-md p-3"
                  >
                    <span className="font-medium break-all">
                      {item.project?.name} ({item.project?.repositoryIdentifier}
                      )
                    </span>
                    <div className="space-x-2 flex shrink-0">
                      {!isCurrentProject &&<Button
                        size="sm"
                        variant={"outline"}
                        onClick={() =>
                          void handleDeleteClick(
                            item.project?.repositoryIdentifier,
                            item.project?.defaultDashboardId
                          )
                        }
                      >
                        <img
                          src="./icons/trash-solid-full.svg"
                          alt="Delete"
                          width={16}
                          height={16}
                        />
                      </Button>}
                      <Button
                        variant={isCurrentProject ? "outline" : "default"}
                        size="sm"
                        onClick={() =>
                          void handleLoadClick(
                            item.project?.repositoryIdentifier,
                            item.project?.defaultDashboardId
                          )
                        }
                      >
                        {isCurrentProject ? "Current" : "Load"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoadOtherProjectDialog;
