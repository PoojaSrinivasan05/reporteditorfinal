import { Button } from "@/components/ui/button";
import { Highlighter, MessageSquare, Eraser } from "lucide-react";

interface AnnotationToolsProps {
  activeTool: "highlight" | "comment" | "none";
  onToolChange: (tool: "highlight" | "comment" | "none") => void;
  highlightColor: string;
  onColorChange: (color: string) => void;
}

export const AnnotationTools = ({
  activeTool,
  onToolChange,
  highlightColor,
  onColorChange,
}: AnnotationToolsProps) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-card border border-border/30 rounded-lg">
      <Button
        variant={activeTool === "highlight" ? "default" : "ghost"}
        size="sm"
        onClick={() => onToolChange(activeTool === "highlight" ? "none" : "highlight")}
        title="Highlight"
      >
        <Highlighter className="h-4 w-4 mr-2" />
        Highlight
      </Button>
      <Button
        variant={activeTool === "comment" ? "default" : "ghost"}
        size="sm"
        onClick={() => onToolChange(activeTool === "comment" ? "none" : "comment")}
        title="Add Comment"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Comment
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToolChange("none")}
        title="Clear Tool"
      >
        <Eraser className="h-4 w-4 mr-2" />
        Clear
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <input
        type="color"
        value={highlightColor}
        onChange={(e) => onColorChange(e.target.value)}
        className="h-8 w-12 rounded cursor-pointer border border-border/50"
        title="Highlight Color"
      />
    </div>
  );
};
