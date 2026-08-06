"use client";

import { ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProductPhoto } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type ProductPhotoLibraryProps = {
  companySlug: string;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_MB = 10;

export function ProductPhotoLibrary({ companySlug }: ProductPhotoLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ProductPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiBase = `/api/dashboard/${companySlug}/product-photos`;

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiBase);
      const payload = (await response.json()) as {
        data: ProductPhoto[] | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to load product photos.");
      }

      setPhotos(payload.data ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load product photos.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    return () => {
      if (pendingPreview) {
        URL.revokeObjectURL(pendingPreview);
      }
    };
  }, [pendingPreview]);

  function resetAddForm() {
    setShowAddForm(false);
    setNewName("");
    setNewDescription("");
    setPendingFile(null);
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview);
    }
    setPendingPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP file.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Photo must be under ${MAX_SIZE_MB}MB.`);
      return;
    }

    setPendingFile(file);
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview);
    }
    setPendingPreview(URL.createObjectURL(file));
  }

  async function handleAddPhoto() {
    if (!pendingFile) {
      toast.error("Please select a product photo.");
      return;
    }

    if (!newName.trim()) {
      toast.error("Product name is required.");
      return;
    }

    setAdding(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("name", newName.trim());
      if (newDescription.trim()) {
        formData.append("description", newDescription.trim());
      }

      const response = await fetch(apiBase, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        data: ProductPhoto | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to add product photo.");
      }

      if (payload.data) {
        setPhotos((current) => [payload.data!, ...current]);
      } else {
        await loadPhotos();
      }

      toast.success("Product photo added.");
      resetAddForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add product photo.";
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(photo: ProductPhoto) {
    setUpdatingId(photo.id);
    try {
      const response = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id, active: !photo.active }),
      });

      const payload = (await response.json()) as {
        data: ProductPhoto | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to update product photo.");
      }

      if (payload.data) {
        setPhotos((current) =>
          current.map((item) => (item.id === photo.id ? payload.data! : item))
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update product photo.";
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);
    try {
      const response = await fetch(`${apiBase}?id=${photoId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as {
        data: { id: string } | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to delete product photo.");
      }

      setPhotos((current) => current.filter((item) => item.id !== photoId));
      toast.success("Product photo removed.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete product photo.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6b7280] dark:text-slate-400">
        Upload real product photos for the AI to use as visual references when
        generating marketing images. Active photos are included in weekly
        ideation.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[#6b7280] dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading product library...
        </div>
      ) : photos.length === 0 && !showAddForm ? (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-6 py-10 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-[#6b7280] dark:text-slate-400">No product photos yet.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-[#2e2e5a]"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add product photo
          </Button>
        </div>
      ) : (
        <>
          {photos.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className={cn(
                    "overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]",
                    !photo.active && "opacity-60"
                  )}
                >
                  <div className="aspect-square bg-[#f8fafc] dark:bg-[#1f1f1f]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.photo_url}
                      alt={photo.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {photo.name}
                        </p>
                        {photo.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[#6b7280] dark:text-slate-400">
                            {photo.description}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-[#6b7280] dark:text-slate-400 hover:text-red-400"
                        disabled={deletingId === photo.id}
                        onClick={() => void handleDelete(photo.id)}
                      >
                        {deletingId === photo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[#6b7280] dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={photo.active}
                        disabled={updatingId === photo.id}
                        onChange={() => void handleToggleActive(photo)}
                        className="rounded border-[#2e2e5a]"
                      />
                      Active in ideation
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!showAddForm ? (
            <Button
              type="button"
              variant="outline"
              className="border-[#2e2e5a]"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add product photo
            </Button>
          ) : null}
        </>
      )}

      {showAddForm ? (
        <div className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] p-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product name</Label>
            <Input
              id="product-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Jerk Chicken Plate"
              className="border-[#2e2e5a] bg-white dark:bg-[#161616]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">Description (optional)</Label>
            <Textarea
              id="product-description"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Brief description for the AI ideation prompt"
              className="min-h-[80px] border-[#2e2e5a] bg-white dark:bg-[#161616]"
            />
          </div>
          <div className="space-y-2">
            <Label>Photo</Label>
            <div
              className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#2e2e5a] bg-white dark:bg-[#161616] p-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(event) => handleFileSelect(event.target.files?.[0])}
              />
              {pendingPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pendingPreview}
                  alt="Preview"
                  className="max-h-32 rounded object-contain"
                />
              ) : (
                <>
                  <ImageIcon className="mb-2 h-6 w-6 text-[#9ca3af] dark:text-slate-500" />
                  <p className="text-sm text-[#6b7280] dark:text-slate-400">
                    Click to upload PNG, JPG, or WEBP (max {MAX_SIZE_MB}MB)
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={resetAddForm}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-tbc-red hover:bg-tbc-red-hover"
              disabled={adding}
              onClick={() => void handleAddPhoto()}
            >
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save product photo"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
