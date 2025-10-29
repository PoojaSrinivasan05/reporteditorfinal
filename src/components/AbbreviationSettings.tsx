import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus, Edit2, X, List } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AbbreviationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  abbreviations: Record<string, string>;
  onAdd: (code: string, text: string) => void;
  onDelete: (code: string) => void;
}

export const AbbreviationSettings = ({
  isOpen,
  onClose,
  abbreviations,
  onAdd,
  onDelete,
}: AbbreviationSettingsProps) => {
  const [newCode, setNewCode] = useState("");
  const [newText, setNewText] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [showListDialog, setShowListDialog] = useState(false);

  const handleAdd = () => {
    if (!newCode.trim() || !newText.trim()) {
      toast({
        title: "Invalid input",
        description: "Both code and text are required.",
        variant: "destructive",
      });
      return;
    }

    if (editingCode) {
      // Update existing abbreviation
      if (editingCode !== newCode.trim()) {
        // Code changed, delete old one
        onDelete(editingCode);
      }
      onAdd(newCode.trim(), newText);
      setEditingCode(null);
      setNewCode("");
      setNewText("");
      toast({
        title: "Abbreviation updated",
        description: `Code '${newCode}' has been updated.`,
      });
    } else {
      // Add new abbreviation
      if (abbreviations[newCode]) {
        toast({
          title: "Code exists",
          description: "This abbreviation code already exists. Use edit to update it.",
          variant: "destructive",
        });
        return;
      }

      onAdd(newCode.trim(), newText);
      setNewCode("");
      setNewText("");
      toast({
        title: "Abbreviation added",
        description: `Code '${newCode}' has been saved.`,
      });
    }
  };

  const handleEdit = (code: string) => {
    setEditingCode(code);
    setNewCode(code);
    setNewText(abbreviations[code]);
  };

  const handleCancelEdit = () => {
    setEditingCode(null);
    setNewCode("");
    setNewText("");
  };

  const handleDelete = (code: string) => {
    onDelete(code);
    toast({
      title: "Abbreviation deleted",
      description: `Code '${code}' has been removed.`,
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Abbreviations</DialogTitle>
            <DialogDescription>
              Create shortcuts that expand into full paragraphs when you type them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
          {/* Add/Edit abbreviation */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            {editingCode && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Editing: {editingCode}</span>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="code">Abbreviation Code</Label>
              <Input
                id="code"
                placeholder="e.g., 123, sig, intro"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleAdd();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="text">Full Text</Label>
              <Textarea
                id="text"
                placeholder="Enter the full text that will replace the code..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} className="flex-1" size="sm">
                {editingCode ? (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Update Abbreviation
                  </>
                ) : (
                  <>
                    Submit
                  </>
                )}
              </Button>
              {editingCode && (
                <Button onClick={handleCancelEdit} variant="outline" size="sm">
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* View existing abbreviations button */}
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => setShowListDialog(true)}
              className="w-full"
            >
              <List className="w-4 h-4 mr-2" />
              View All Abbreviations ({Object.keys(abbreviations).length})
            </Button>
          </div>
        </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abbreviations List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Available Abbreviations</DialogTitle>
            <DialogDescription>
              View, edit, or delete your text abbreviations.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            {Object.keys(abbreviations).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-1">No abbreviations yet</p>
                <p className="text-sm">Add some abbreviations to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(abbreviations).map(([code, text]) => (
                  <div
                    key={code}
                    className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono font-bold text-lg text-primary">
                            {code}
                          </span>
                          <span className="text-sm text-muted-foreground">→</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                          {text}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleEdit(code);
                            setShowListDialog(false);
                          }}
                          className="h-9 w-9"
                          title="Edit abbreviation"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(code)}
                          className="h-9 w-9"
                          title="Delete abbreviation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
