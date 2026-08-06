"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestAdminApi } from "@/lib/onboarding/admin-api";
import {
  DAY_NAMES,
  type BusinessHourRow,
  type CatalogueItemRow,
} from "@/lib/validations/catalogue";

type CatalogueTabProps = {
  companyId: string;
  onSectionConfirmed: () => Promise<void>;
};

type HourDraft = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  closed: boolean;
};

type NewItemDraft = {
  item_name: string;
  category: string;
  price_jmd: string;
  description: string;
  available: boolean;
  seasonal: boolean;
};

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "17:00";

function createDefaultHours(): HourDraft[] {
  return DAY_NAMES.map((_, dayOfWeek) => ({
    day_of_week: dayOfWeek,
    open_time: DEFAULT_OPEN,
    close_time: DEFAULT_CLOSE,
    closed: dayOfWeek === 0,
  }));
}

function mergeHoursWithDefaults(rows: BusinessHourRow[]): HourDraft[] {
  const defaults = createDefaultHours();
  const byDay = new Map(rows.map((row) => [row.day_of_week, row]));

  return defaults.map((defaultRow) => {
    const existing = byDay.get(defaultRow.day_of_week);
    if (!existing) {
      return defaultRow;
    }

    return {
      day_of_week: defaultRow.day_of_week,
      open_time: existing.open_time?.slice(0, 5) ?? DEFAULT_OPEN,
      close_time: existing.close_time?.slice(0, 5) ?? DEFAULT_CLOSE,
      closed: Boolean(existing.closed),
    };
  });
}

function emptyNewItem(): NewItemDraft {
  return {
    item_name: "",
    category: "",
    price_jmd: "",
    description: "",
    available: true,
    seasonal: false,
  };
}

export function CatalogueTab({
  companyId,
  onSectionConfirmed,
}: CatalogueTabProps) {
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [items, setItems] = useState<CatalogueItemRow[]>([]);
  const [hours, setHours] = useState<HourDraft[]>(createDefaultHours());
  const [newItem, setNewItem] = useState<NewItemDraft>(emptyNewItem());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<NewItemDraft>(emptyNewItem());
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogueResult, hoursResult] = await Promise.all([
        requestAdminApi<CatalogueItemRow[]>(
          `/api/admin/catalogue?company_id=${companyId}`
        ),
        requestAdminApi<BusinessHourRow[]>(
          `/api/admin/hours?company_id=${companyId}`
        ),
      ]);

      setItems(catalogueResult);
      setHours(mergeHoursWithDefaults(hoursResult));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load menu data."
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, CatalogueItemRow[]>();

    for (const item of items) {
      const category = item.category?.trim() || "General";
      const existing = grouped.get(category) ?? [];
      existing.push(item);
      grouped.set(category, existing);
    }

    return Array.from(grouped.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [items]);

  async function handleSaveHours() {
    setSavingHours(true);
    try {
      await requestAdminApi<BusinessHourRow[]>("/api/admin/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          hours: hours.map((hour) => ({
            day_of_week: hour.day_of_week,
            open_time: hour.closed ? null : hour.open_time,
            close_time: hour.closed ? null : hour.close_time,
            closed: hour.closed,
          })),
        }),
      });
      await onSectionConfirmed();
      toast.success("Hours saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save hours."
      );
    } finally {
      setSavingHours(false);
    }
  }

  async function handleAddItem(event: React.FormEvent) {
    event.preventDefault();

    if (!newItem.item_name.trim()) {
      toast.error("Item name is required.");
      return;
    }

    setAddingItem(true);
    try {
      const created = await requestAdminApi<CatalogueItemRow>(
        "/api/admin/catalogue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            item_name: newItem.item_name.trim(),
            category: newItem.category.trim() || null,
            price_jmd: newItem.price_jmd ? Number(newItem.price_jmd) : null,
            description: newItem.description.trim() || null,
            available: newItem.available,
            seasonal: newItem.seasonal,
          }),
        }
      );

      setItems((current) => [...current, created]);
      setNewItem(emptyNewItem());
      await onSectionConfirmed();
      toast.success("Item added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add item."
      );
    } finally {
      setAddingItem(false);
    }
  }

  function startEditing(item: CatalogueItemRow) {
    setEditingId(item.id);
    setEditDraft({
      item_name: item.item_name,
      category: item.category ?? "",
      price_jmd: item.price_jmd != null ? String(item.price_jmd) : "",
      description: item.description ?? "",
      available: item.available,
      seasonal: item.seasonal,
    });
  }

  async function handleSaveEdit(itemId: string) {
    if (!editDraft.item_name.trim()) {
      toast.error("Item name is required.");
      return;
    }

    setSavingEditId(itemId);
    try {
      const updated = await requestAdminApi<CatalogueItemRow>(
        `/api/admin/catalogue/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_name: editDraft.item_name.trim(),
            category: editDraft.category.trim() || null,
            price_jmd: editDraft.price_jmd ? Number(editDraft.price_jmd) : null,
            description: editDraft.description.trim() || null,
            available: editDraft.available,
            seasonal: editDraft.seasonal,
          }),
        }
      );

      setItems((current) =>
        current.map((item) => (item.id === itemId ? updated : item))
      );
      setEditingId(null);
      await onSectionConfirmed();
      toast.success("Item updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update item."
      );
    } finally {
      setSavingEditId(null);
    }
  }

  async function handleDeleteItem(itemId: string, itemName: string) {
    if (!window.confirm(`Delete "${itemName}"?`)) {
      return;
    }

    setDeletingId(itemId);
    try {
      await requestAdminApi<{ id: string }>(`/api/admin/catalogue/${itemId}`, {
        method: "DELETE",
      });
      setItems((current) => current.filter((item) => item.id !== itemId));
      toast.success("Item deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete item."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading menu and hours...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#111111] dark:text-white">Opening hours</h3>
          <p className="text-sm text-text-muted">
            Set weekly hours used in content generation context.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] dark:border-[#2a2a2a]">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] dark:bg-[#0a0a0a] text-left text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Day</th>
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 font-medium">Open</th>
                <th className="px-4 py-3 font-medium">Close</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((hour, index) => (
                <tr key={hour.day_of_week} className="border-t border-[#E5E7EB] dark:border-[#2a2a2a]">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {DAY_NAMES[hour.day_of_week]}
                  </td>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={hour.closed}
                      onCheckedChange={(checked) =>
                        setHours((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, closed: checked === true }
                              : row
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="time"
                      value={hour.open_time}
                      disabled={hour.closed}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, open_time: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="time"
                      value={hour.close_time}
                      disabled={hour.closed}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, close_time: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            className="bg-tbc-red hover:bg-tbc-red-hover"
            disabled={savingHours}
            onClick={() => void handleSaveHours()}
          >
            {savingHours ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save hours"
            )}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#111111] dark:text-white">Menu / catalogue</h3>
          <p className="text-sm text-text-muted">
            Add menu items or products for AI copy context.
          </p>
        </div>

        <form
          onSubmit={(event) => void handleAddItem(event)}
          className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] p-4"
        >
          <p className="text-sm font-medium text-text-primary">Add item</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item_name">Item name *</Label>
              <Input
                id="item_name"
                value={newItem.item_name}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    item_name: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={newItem.category}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="e.g. Mains, Cocktails"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_jmd">Price (JMD)</Label>
              <Input
                id="price_jmd"
                type="number"
                min={0}
                step="1"
                value={newItem.price_jmd}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    price_jmd: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newItem.description}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newItem.available}
                onCheckedChange={(checked) =>
                  setNewItem((current) => ({
                    ...current,
                    available: checked === true,
                  }))
                }
              />
              Available
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newItem.seasonal}
                onCheckedChange={(checked) =>
                  setNewItem((current) => ({
                    ...current,
                    seasonal: checked === true,
                  }))
                }
              />
              Seasonal
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-tbc-red hover:bg-tbc-red-hover"
              disabled={addingItem}
            >
              {addingItem ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add item"
              )}
            </Button>
          </div>
        </form>

        {itemsByCategory.length === 0 ? (
          <p className="text-sm italic text-text-muted">No catalogue items yet.</p>
        ) : (
          <div className="space-y-6">
            {itemsByCategory.map(([category, categoryItems]) => (
              <div key={category} className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                  {category}
                </h4>
                <div className="space-y-3">
                  {categoryItems.map((item) => {
                    const isEditing = editingId === item.id;

                    if (isEditing) {
                      return (
                        <div
                          key={item.id}
                          className="space-y-3 rounded-lg border border-border p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              value={editDraft.item_name}
                              onChange={(event) =>
                                setEditDraft((current) => ({
                                  ...current,
                                  item_name: event.target.value,
                                }))
                              }
                            />
                            <Input
                              value={editDraft.category}
                              onChange={(event) =>
                                setEditDraft((current) => ({
                                  ...current,
                                  category: event.target.value,
                                }))
                              }
                              placeholder="Category"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={editDraft.price_jmd}
                              onChange={(event) =>
                                setEditDraft((current) => ({
                                  ...current,
                                  price_jmd: event.target.value,
                                }))
                              }
                              placeholder="Price JMD"
                            />
                            <Textarea
                              value={editDraft.description}
                              onChange={(event) =>
                                setEditDraft((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              rows={2}
                              placeholder="Description"
                            />
                          </div>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={editDraft.available}
                                onCheckedChange={(checked) =>
                                  setEditDraft((current) => ({
                                    ...current,
                                    available: checked === true,
                                  }))
                                }
                              />
                              Available
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={editDraft.seasonal}
                                onCheckedChange={(checked) =>
                                  setEditDraft((current) => ({
                                    ...current,
                                    seasonal: checked === true,
                                  }))
                                }
                              />
                              Seasonal
                            </label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="bg-tbc-red hover:bg-tbc-red-hover"
                              disabled={savingEditId === item.id}
                              onClick={() => void handleSaveEdit(item.id)}
                            >
                              {savingEditId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-text-primary">
                              {item.item_name}
                            </p>
                            {item.price_jmd != null ? (
                              <span className="text-sm text-text-muted">
                                ${Number(item.price_jmd).toLocaleString()} JMD
                              </span>
                            ) : null}
                            <span
                              className={
                                item.available
                                  ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600"
                                  : "rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600"
                              }
                            >
                              {item.available ? "Available" : "Unavailable"}
                            </span>
                            {item.seasonal ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600">
                                Seasonal
                              </span>
                            ) : null}
                          </div>
                          {item.description ? (
                            <p className="text-sm text-text-muted">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditing(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === item.id}
                            onClick={() =>
                              void handleDeleteItem(item.id, item.item_name)
                            }
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
