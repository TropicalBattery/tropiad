"use client";

import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type AssetUploaderProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  slug: string;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE_MB = 5;

export function AssetUploader({ value, onChange, slug }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, WEBP, or SVG file.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Logo must be under ${MAX_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);

    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop() ?? "png";
      const path = `${slug || "draft"}/logo-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("brand-assets").getPublicUrl(path);

      onChange(publicUrl);
      toast.success("Logo uploaded successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload logo.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void uploadFile(file);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  }

  function clearLogo() {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-6 py-8 transition-colors",
          isDragging
            ? "border-[#0D9488] bg-[#0D9488]/5"
            : "border-slate-300 hover:border-[#0D9488]/60"
        )}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
            <p className="text-sm">Uploading logo...</p>
          </div>
        ) : value ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Uploaded logo preview"
              className="max-h-24 max-w-full object-contain"
            />
            <p className="text-sm text-slate-600">
              Click or drag to replace logo
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <div className="rounded-full bg-[#0B1C3D]/10 p-3">
              <Upload className="h-6 w-6 text-[#374151] dark:text-slate-300" />
            </div>
            <p className="text-sm font-medium text-[#374151] dark:text-slate-300">
              Drag and drop your logo here
            </p>
            <p className="text-xs text-[#9ca3af] dark:text-slate-500">
              PNG, JPG, WEBP, or SVG up to {MAX_SIZE_MB}MB
            </p>
          </div>
        )}
      </div>

      {value && (
        <div className="flex items-center justify-between rounded-md border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-3 py-2 text-sm">
          <div className="flex items-center gap-2 truncate text-slate-600">
            <ImageIcon className="h-4 w-4 shrink-0 text-[#0D9488]" />
            <span className="truncate">{value}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearLogo}
            className="shrink-0 text-[#9ca3af] dark:text-slate-500 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
