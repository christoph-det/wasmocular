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

interface LoadOtherProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set false when opening from nested menus to avoid focus locking the page */
  modal?: boolean;
}

const LoadOtherProjectDialog = ({
  open,
  onOpenChange
}: LoadOtherProjectDialogProps) => {
  const indexingStore = useStores().indexingStore;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Other Project</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {indexingStore.listAllStoredProjects().length === 1 ? (
            <p>No other projects found in local storage.</p>
          ) : (
            <div className="space-y-2">
              {indexingStore.listAllStoredProjects().map((project) => {
                // Skip current project and projects without identifier
                if (
                  project.project?.repositoryIdentifier ===
                    indexingStore.project?.repositoryIdentifier ||
                  !project.project?.repositoryIdentifier
                ) {
                  return null;
                }
                return (
                  <div
                    key={project.project?.repositoryIdentifier}
                    className="flex justify-between items-center border border-gray-200 rounded-md p-3"
                  >
                    <span className="font-medium">{project.project?.name}</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        indexingStore.loadFromStorage(
                          project.project?.repositoryIdentifier
                        );
                        onOpenChange(false);
                      }}
                    >
                      Load
                    </Button>
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
