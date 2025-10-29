import { useRef, useEffect } from "react";

interface PageEditorProps {
  content: string;
  pageNum: number;
  onChange: (content: string, pageNum: number) => void;
}

export const PageEditor = ({ content, pageNum, onChange }: PageEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML, pageNum);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 p-2 bg-muted/30 rounded-lg border border-border/30">
          <p className="text-sm text-muted-foreground">Editing Page {pageNum}</p>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className="min-h-[600px] bg-card shadow-lg rounded-xl p-8 border border-border/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all prose prose-slate max-w-none"
          style={{
            caretColor: "hsl(180 65% 55%)",
            lineHeight: "1.8",
          }}
        />
      </div>
    </div>
  );
};
