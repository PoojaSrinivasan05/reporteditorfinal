import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AbbreviationPopupProps {
  isOpen: boolean;
  code: string;
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AbbreviationPopup = ({
  isOpen,
  code,
  text,
  onConfirm,
  onCancel,
}: AbbreviationPopupProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abbreviation found for '{code}'</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-2">Insert saved paragraph?</p>
              <div className="mt-3 p-3 bg-muted rounded-md max-h-40 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-sans">{text}</pre>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            No, keep code
          </Button>
          <Button onClick={onConfirm}>
            Yes, insert paragraph
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
