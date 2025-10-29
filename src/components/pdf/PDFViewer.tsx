import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

// Configure PDF.js worker via workerPort (Vite)
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

interface PDFViewerProps {
  pdfUrl: string | null;
  onPageChange?: (pageNum: number) => void;
  annotations?: Annotation[];
  onAddAnnotation?: (annotation: Annotation) => void;
}

export interface Annotation {
  id: string;
  pageNum: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "highlight" | "comment";
  color: string;
  text?: string;
}

export const PDFViewer = ({ pdfUrl, onPageChange, annotations = [], onAddAnnotation }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!pdfUrl) return;

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        renderPage(pdfDoc, 1);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };

    loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdf) {
      renderPage(pdf, currentPage);
    }
  }, [currentPage, scale, pdf]);

  useEffect(() => {
    renderAnnotations();
  }, [annotations, currentPage]);

  const renderPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

await (page as any).render({
  canvasContext: context,
  viewport: viewport,
}).promise;

// Resize annotation canvas to match
const ann = annotationCanvasRef.current;
if (ann) {
  ann.width = canvas.width;
  ann.height = canvas.height;
}

onPageChange?.(pageNum);
  };

  const renderAnnotations = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const pageAnnotations = annotations.filter((a) => a.pageNum === currentPage);
    pageAnnotations.forEach((annotation) => {
      context.fillStyle = annotation.color;
      context.globalAlpha = 0.3;
      context.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
      context.globalAlpha = 1;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = annotationCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDrawing(true);
    setStartPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const rect = annotationCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const annotation: Annotation = {
      id: `annotation-${Date.now()}`,
      pageNum: currentPage,
      x: Math.min(startPos.x, endX),
      y: Math.min(startPos.y, endY),
      width: Math.abs(endX - startPos.x),
      height: Math.abs(endY - startPos.y),
      type: "highlight",
      color: "#FFFF00",
    };

    onAddAnnotation?.(annotation);
    setIsDrawing(false);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const zoomIn = () => setScale(Math.min(scale + 0.25, 3));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg border border-border/30">
        <p className="text-muted-foreground">Upload a PDF to view it here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between p-2 bg-card border-b border-border/30">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextPage} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/10 p-4 flex items-center justify-center">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="border border-border/30 shadow-lg block max-w-full h-auto" />
          <canvas
            ref={annotationCanvasRef}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{ pointerEvents: "auto" }}
            width={canvasRef.current?.width}
            height={canvasRef.current?.height}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
        </div>
      </div>
    </div>
  );
};
