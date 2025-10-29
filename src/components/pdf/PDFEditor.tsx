import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { PDFDocument, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Type, Trash2, Save, Image as ImageIcon, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

interface TextEdit {
  id: string;
  page_number: number;
  content: string;
  position_x: number;
  position_y: number;
  font_size: number;
  color: string;
  isEditing?: boolean;
  isOriginal?: boolean; // Track if this is original PDF text
}

interface ImageEdit {
  id: string;
  page_number: number;
  image_url: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_deleted: boolean;
}

interface PDFEditorProps {
  pdfUrl: string;
  reportId: string;
  onDownloadPDF?: () => void;
}

export const PDFEditor = ({ pdfUrl, reportId, onDownloadPDF }: PDFEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [textEdits, setTextEdits] = useState<TextEdit[]>([]);
  const [imageEdits, setImageEdits] = useState<ImageEdit[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState("#000000");
  const [dragging, setDragging] = useState<{
    id: string;
    type: "text" | "image";
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [originalMasks, setOriginalMasks] = useState<Record<number, { x: number; y: number; w: number; h: number }[]>>({});
  const [hiddenOriginalIds, setHiddenOriginalIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPdf();
    loadEdits();
  }, [pdfUrl, reportId]);

  useEffect(() => {
    if (pdf && currentPage) {
      extractTextFromPage(pdf, currentPage);
    }
  }, [pdf, currentPage, scale]);

  useEffect(() => {
    if (pdf) {
      renderPage(pdf, currentPage);
    }
  }, [currentPage, scale, pdf, textEdits]);

  const loadPdf = async () => {
    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast({
        title: "Error",
        description: "Failed to load PDF",
        variant: "destructive",
      });
    }
  };

  const extractTextFromPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale });

      const originalTexts: TextEdit[] = [];
      const masks: { x: number; y: number; w: number; h: number }[] = [];

      (textContent.items as any[]).forEach((item: any) => {
        const str = item.str?.trim();
        if (!str) return;

        const transform = item.transform; // [a, b, c, d, e, f]
        const x = transform[4];
        const yPdf = transform[5];
        const y = viewport.height - yPdf; // Flip Y coordinate to canvas space
        const a = Math.abs(transform[0]);
        const fontSize = a || Math.max(item.height || 0, 10);
        const width = (item.width || str.length * fontSize * 0.6);
        const height = fontSize * 1.2;

        originalTexts.push({
          id: `original-${pageNum}-${x}-${y}`,
          page_number: pageNum,
          content: str,
          position_x: x,
          position_y: y,
          font_size: fontSize,
          color: "#000000",
          isOriginal: true,
        });

        masks.push({ x, y: y - height + fontSize * 0.2, w: width, h: height });
      });

      // Store masks for this page (used to hide original text on the bitmap)
      setOriginalMasks((prev) => ({ ...prev, [pageNum]: masks }));

      // Merge with user edits - keep user edits, add original texts if not already present
      setTextEdits((prevEdits) => {
        const userEdits = prevEdits.filter((edit) => !edit.isOriginal);
        const hasCurrentOriginals = prevEdits.some((e) => e.isOriginal && e.page_number === pageNum);
        if (!hasCurrentOriginals) {
          return [...userEdits, ...originalTexts];
        }
        return prevEdits;
      });
    } catch (error) {
      console.error("Error extracting text:", error);
    }
  };
  const loadEdits = async () => {
    try {
      const { data, error } = await supabase
        .from("pdf_edits")
        .select("*")
        .eq("report_id", reportId);

      if (error) throw error;

      if (data) {
        const texts: TextEdit[] = [];
        const images: ImageEdit[] = [];

        data.forEach((edit) => {
          if (edit.edit_type === "text") {
            texts.push({
              id: edit.id,
              page_number: edit.page_number,
              content: edit.content || "",
              position_x: Number(edit.position_x),
              position_y: Number(edit.position_y),
              font_size: edit.font_size || 16,
              color: edit.color || "#000000",
              isOriginal: false,
            });
          } else if (edit.edit_type === "image") {
            images.push({
              id: edit.id,
              page_number: edit.page_number,
              image_url: edit.image_url || "",
              position_x: Number(edit.position_x),
              position_y: Number(edit.position_y),
              width: Number(edit.width) || 200,
              height: Number(edit.height) || 200,
              is_deleted: edit.is_deleted || false,
            });
          }
        });

        setTextEdits(texts);
        setImageEdits(images);
      }
    } catch (error) {
      console.error("Error loading edits:", error);
    }
  };

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

    // Mask original PDF text so overlays are the only visible text
    const masks = originalMasks[pageNum] || [];
    if (masks.length > 0) {
      context.save();
      context.fillStyle = "#ffffff";
      masks.forEach((r) => {
        context.fillRect(r.x, r.y, r.w, r.h);
      });
      context.restore();
    }
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAddingText && !isAddingImage) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isAddingText) {
      const newEdit: TextEdit = {
        id: crypto.randomUUID(),
        page_number: currentPage,
        content: "Double-click to edit",
        position_x: x,
        position_y: y,
        font_size: fontSize,
        color: textColor,
        isEditing: false,
      };

      setTextEdits([...textEdits, newEdit]);
      setIsAddingText(false);
      await saveEdit(newEdit);
    } else if (isAddingImage) {
      imageInputRef.current?.click();
    }
  };

  const saveEdit = async (edit: TextEdit) => {
    try {
      const { error } = await supabase.from("pdf_edits").insert({
        id: edit.id,
        report_id: reportId,
        page_number: edit.page_number,
        edit_type: "text",
        content: edit.content,
        position_x: edit.position_x,
        position_y: edit.position_y,
        font_size: edit.font_size,
        color: edit.color,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving edit:", error);
      toast({
        title: "Error",
        description: "Failed to save edit",
        variant: "destructive",
      });
    }
  };

  const updateEdit = async (editId: string, content: string) => {
    const edit = textEdits.find(e => e.id === editId);
    if (!edit) return;

    try {
      // If it's original PDF text, create a new edit entry
      if (edit.isOriginal) {
        const newEdit = {
          id: crypto.randomUUID(),
          report_id: reportId,
          page_number: edit.page_number,
          edit_type: "text" as const,
          content: content,
          position_x: edit.position_x,
          position_y: edit.position_y,
          font_size: edit.font_size,
          color: edit.color,
        };

        const { error } = await supabase.from("pdf_edits").insert(newEdit);
        if (error) throw error;

        // Remove original text and add new edited version
        setTextEdits(
          textEdits.map((e) =>
            e.id === editId ? { ...e, content, isOriginal: false, id: newEdit.id } : e
          )
        );
      } else {
        // Update existing edit
        const { error } = await supabase
          .from("pdf_edits")
          .update({ content })
          .eq("id", editId);

        if (error) throw error;

        setTextEdits(
          textEdits.map((e) =>
            e.id === editId ? { ...e, content } : e
          )
        );
      }
    } catch (error) {
      console.error("Error updating edit:", error);
    }
  };

  const deleteEdit = async (editId: string) => {
    const edit = textEdits.find(e => e.id === editId);
    if (!edit) return;

    try {
      // Only delete from database if it's not original text
      if (!edit.isOriginal) {
        const { error } = await supabase.from("pdf_edits").delete().eq("id", editId);
        if (error) throw error;
      }

      setTextEdits(textEdits.filter((e) => e.id !== editId));
      toast({
        title: "Deleted",
        description: edit.isOriginal ? "Original text hidden" : "Edit removed",
      });
    } catch (error) {
      console.error("Error deleting edit:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = rect.width / 2 - 100;
        const y = rect.height / 2 - 100;

        const newImage: ImageEdit = {
          id: crypto.randomUUID(),
          page_number: currentPage,
          image_url: imageUrl,
          position_x: x,
          position_y: y,
          width: 200,
          height: 200,
          is_deleted: false,
        };

        setImageEdits([...imageEdits, newImage]);
        setIsAddingImage(false);

        // Save to database
        await supabase.from("pdf_edits").insert({
          id: newImage.id,
          report_id: reportId,
          page_number: newImage.page_number,
          edit_type: "image",
          image_url: newImage.image_url,
          position_x: newImage.position_x,
          position_y: newImage.position_y,
          width: newImage.width,
          height: newImage.height,
          is_deleted: false,
        });

        toast({
          title: "Image added",
          description: "Image inserted successfully",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to add image",
        variant: "destructive",
      });
    }

    e.target.value = "";
  };

  const deleteImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from("pdf_edits")
        .update({ is_deleted: true })
        .eq("id", imageId);

      if (error) throw error;

      setImageEdits(imageEdits.map((img) =>
        img.id === imageId ? { ...img, is_deleted: true } : img
      ));

      toast({
        title: "Image removed",
        description: "Image deleted from PDF",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  // Dragging handlers for text and images
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragging.offsetX;
      const newY = e.clientY - rect.top - dragging.offsetY;

      if (dragging.type === "text") {
        setTextEdits((prev) => prev.map((t) => (t.id === dragging.id ? { ...t, position_x: newX, position_y: newY } : t)));
      } else {
        setImageEdits((prev) => prev.map((img) => (img.id === dragging.id ? { ...img, position_x: newX, position_y: newY } : img)));
      }
    };

    const onUp = async () => {
      if (!dragging) return;
      if (dragging.type === "text") {
        const edit = textEdits.find((t) => t.id === dragging.id);
        if (edit) {
          try {
            if (edit.isOriginal) {
              // Promote to a real edit record
              const newId = crypto.randomUUID();
              const insertPayload = {
                id: newId,
                report_id: reportId,
                page_number: edit.page_number,
                edit_type: "text" as const,
                content: edit.content,
                position_x: edit.position_x,
                position_y: edit.position_y,
                font_size: edit.font_size,
                color: edit.color,
              };
              const { error } = await supabase.from("pdf_edits").insert(insertPayload);
              if (error) throw error;
              setTextEdits((prev) => prev.map((t) => (t.id === edit.id ? { ...t, id: newId, isOriginal: false } : t)));
            } else {
              await supabase
                .from("pdf_edits")
                .update({ position_x: edit.position_x, position_y: edit.position_y })
                .eq("id", edit.id);
            }
          } catch (err) {
            console.error("Failed to persist drag move:", err);
          }
        }
      } else {
        const img = imageEdits.find((i) => i.id === dragging.id);
        if (img) {
          try {
            await supabase
              .from("pdf_edits")
              .update({ position_x: img.position_x, position_y: img.position_y })
              .eq("id", img.id);
          } catch (err) {
            console.error("Failed to persist image move:", err);
          }
        }
      }
      setDragging(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, textEdits, imageEdits, reportId]);

  // Keyboard delete support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEditId) {
          e.preventDefault();
          deleteEdit(selectedEditId);
        } else if (selectedImageId) {
          e.preventDefault();
          deleteImage(selectedImageId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEditId, selectedImageId]);

  const saveAllEdits = async () => {
    toast({
      title: "Saved",
      description: "All changes have been saved",
    });
  };

  const downloadEditedPDF = async () => {
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we create your edited PDF...",
      });

      const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      for (const edit of textEdits) {
        if (edit.isOriginal) continue;
        
        const page = pages[edit.page_number - 1];
        if (!page) continue;

        const { height } = page.getSize();
        
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255,
          } : { r: 0, g: 0, b: 0 };
        };

        const color = hexToRgb(edit.color);
        const adjustedY = height - edit.position_y - edit.font_size;

        page.drawText(edit.content, {
          x: edit.position_x,
          y: adjustedY,
          size: edit.font_size,
          color: rgb(color.r, color.g, color.b),
        });
      }

      for (const imgEdit of imageEdits) {
        if (imgEdit.is_deleted) continue;
        
        const page = pages[imgEdit.page_number - 1];
        if (!page) continue;

        const { height } = page.getSize();
        
        try {
          const imageBytes = await fetch(imgEdit.image_url).then(res => res.arrayBuffer());
          let image;
          
          if (imgEdit.image_url.includes('.png') || imgEdit.image_url.startsWith('data:image/png')) {
            image = await pdfDoc.embedPng(imageBytes);
          } else {
            image = await pdfDoc.embedJpg(imageBytes);
          }

          const adjustedY = height - imgEdit.position_y - imgEdit.height;

          page.drawImage(image, {
            x: imgEdit.position_x,
            y: adjustedY,
            width: imgEdit.width,
            height: imgEdit.height,
          });
        } catch (err) {
          console.error('Failed to embed image:', err);
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `edited-report-${new Date().getTime()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Your edited PDF has been downloaded",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Expose the download function to parent via the prop
  useEffect(() => {
    if (onDownloadPDF) {
      (window as any).pdfEditorDownload = downloadEditedPDF;
    }
  }, [textEdits, imageEdits, pdfUrl, onDownloadPDF]);
  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const zoomIn = () => setScale(Math.min(scale + 0.25, 3));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));

  return (
    <div className="flex flex-col h-full w-full">
      {/* Single Unified Toolbar */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-card via-card/95 to-card border-b border-border/40 shadow-sm">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/50 rounded-md border border-border/30">
            <span className="text-sm font-medium">{currentPage}</span>
            <span className="text-xs text-muted-foreground">of {totalPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Center: Editing Tools */}
        <div className="flex items-center gap-2">
          <Button
            variant={isAddingText ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setIsAddingText(!isAddingText);
              setIsAddingImage(false);
            }}
            className="h-9"
          >
            <Type className="h-4 w-4 mr-2" />
            Text
          </Button>

          <Button
            variant={isAddingImage ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setIsAddingImage(!isAddingImage);
              setIsAddingText(false);
              imageInputRef.current?.click();
            }}
            className="h-9"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Image
          </Button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <div className="h-6 w-px bg-border/40 mx-1" />

          <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded-md border border-border/30">
            <span className="text-xs text-muted-foreground">Size:</span>
            <Input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-14 h-7 text-xs"
              min="8"
              max="72"
            />
          </div>

          <input
            type="color"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            className="h-9 w-12 rounded-md cursor-pointer border border-border/30"
            title="Text color"
          />
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={zoomOut} className="h-9 w-9">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="px-3 py-1.5 bg-muted/50 rounded-md border border-border/30">
            <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          </div>
          <Button variant="ghost" size="icon" onClick={zoomIn} className="h-9 w-9">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gradient-to-br from-muted/5 via-background to-muted/10 p-6 flex items-center justify-center"
      >
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            className="border-2 border-border/40 shadow-xl rounded-lg block max-w-full h-auto bg-white"
            onClick={handleCanvasClick}
            style={{ cursor: isAddingText || isAddingImage ? "crosshair" : "default" }}
          />

          {/* Image Overlays */}
          {imageEdits
            .filter((img) => img.page_number === currentPage && !img.is_deleted)
            .map((img) => (
              <div
                key={img.id}
                className={`absolute group ${selectedImageId === img.id ? 'ring-2 ring-primary' : ''}`}
                style={{
                  left: `${img.position_x}px`,
                  top: `${img.position_y}px`,
                  cursor: 'move',
                }}
                onClick={() => setSelectedImageId(img.id)}
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName.toLowerCase() === 'button' || target.closest('button')) return;
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const offsetX = e.clientX - rect.left - img.position_x;
                  const offsetY = e.clientY - rect.top - img.position_y;
                  setDragging({ id: img.id, type: 'image', offsetX, offsetY });
                }}
              >
                <img
                  src={img.image_url}
                  alt="PDF annotation"
                  className="border-2 border-primary/50 pointer-events-none"
                  style={{
                    width: `${img.width}px`,
                    height: `${img.height}px`,
                  }}
                />
                <button
                  onClick={() => deleteImage(img.id)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

          {/* Text Edit Overlays */}
          {textEdits
            .filter((edit) => edit.page_number === currentPage)
            .map((edit) => (
              <div
                key={edit.id}
                className="absolute group"
                style={{
                  left: `${edit.position_x}px`,
                  top: `${edit.position_y}px`,
                  fontSize: `${edit.font_size}px`,
                  color: edit.color,
                  cursor: 'move',
                }}
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName.toLowerCase() === 'input' || target.closest('button')) return;
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const offsetX = e.clientX - rect.left - edit.position_x;
                  const offsetY = e.clientY - rect.top - edit.position_y;
                  setDragging({ id: edit.id, type: 'text', offsetX, offsetY });
                  setSelectedEditId(edit.id);
                }}
              >
                <input
                  type="text"
                  value={edit.content}
                  onChange={(e) => updateEdit(edit.id, e.target.value)}
                  onBlur={() => setSelectedEditId(null)}
                  onClick={() => setSelectedEditId(edit.id)}
                  className="bg-white/80 border border-primary/20 focus:bg-white focus:border-primary px-1 rounded hover:bg-white/90 cursor-text min-w-[50px]"
                  style={{ 
                    fontSize: `${Math.max(edit.font_size, 12)}px`, 
                    color: edit.color,
                    width: `${Math.max(50, edit.content.length * Math.max(edit.font_size, 12) * 0.6)}px`
                  }}
                />
                <button
                  onClick={() => deleteEdit(edit.id)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
        </div>
      </div>

    </div>
  );
};
