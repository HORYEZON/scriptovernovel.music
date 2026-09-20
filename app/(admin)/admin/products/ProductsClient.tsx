"use client";

// app/(admin)/admin/products/ProductsClient.tsx
//
// The Store editor. A product is merch with its own title, description,
// photos (up to MAX_PRODUCT_IMAGES), category, price, stock, sizes/formats
// (variants — a full replace on save), availability and featured flag.
// "Create from artwork" is the gallery-era shortcut: pick a piece and the
// product starts with its title, description and picture (and keeps the
// artwork link so it hangs in the Museum's Services Room). Same list/modal
// shape as the Releases module.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Package, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import toast from "@/lib/toast";
import { cn, formatPriceRange, getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { SafeImg } from "@/components/ui/SafeImage";
import { imageVariantUrl } from "@/lib/images/variants";
import { FieldLabel, SelectField, TextField, ToggleRow } from "@/app/(admin)/admin/site-design/fields";
import { productImages, productTitle } from "@/lib/store/product-display";
import { MAX_PRODUCT_DESCRIPTION, MAX_PRODUCT_IMAGES, MAX_PRODUCT_TITLE, PRODUCT_CATEGORIES, productCategoryLabel } from "@/lib/store/categories";

export interface ProductRow {
  id: string;
  artworkId: string | null;
  title: string | null;
  description: string | null;
  images: string[];
  category: string | null;
  slug: string | null;
  featured: boolean;
  sortOrder: number;
  price: number;
  stock: number;
  available: boolean;
  variants: { id: string; label: string; price: number; stock: number }[];
  artwork: { id: string; title: string; imageUrl: string; description: string | null; slug: string | null } | null;
  createdAt: string;
}

export interface ArtworkOption {
  id: string;
  title: string;
  imageUrl: string;
  description: string | null;
}

interface VariantDraft {
  key: number;
  label: string;
  price: string;
  stock: string;
}
interface FormState {
  title: string;
  description: string;
  images: string[];
  category: string;
  price: string;
  stock: string;
  available: boolean;
  featured: boolean;
  variants: VariantDraft[];
  artworkId: string | null;
}

let vKey = 1;
const newVariant = (): VariantDraft => ({ key: vKey++, label: "", price: "", stock: "1" });
const EMPTY: FormState = { title: "", description: "", images: [], category: "", price: "", stock: "1", available: true, featured: false, variants: [], artworkId: null };
const CATEGORY_OPTIONS = [{ value: "", label: "— none —" }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))];
const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

/** Multi-photo uploader: tiles in order, first is the cover; uploads via
 *  POST /api/upload like fields.tsx's ImageField. */
function PhotosField({ images, onChange }: { images: string[]; onChange: (next: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PRODUCT_IMAGES - images.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        urls.push(data.url);
      }
      onChange([...images, ...urls]);
      toast.success(`${urls.length} photo${urls.length === 1 ? "" : "s"} uploaded`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div>
      <FieldLabel hint={`${images.length}/${MAX_PRODUCT_IMAGES} · first is the cover`}>Photos</FieldLabel>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((src, i) => (
          <li key={src} className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
            <SafeImg src={imageVariantUrl(src, "thumb")} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-white disabled:opacity-30" aria-label="Move earlier"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} className="p-0.5 text-white hover:text-red-300" aria-label="Remove"><X size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="p-0.5 text-white disabled:opacity-30" aria-label="Move later"><ArrowDown size={12} /></button>
            </div>
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 font-body text-[9px] uppercase tracking-wider text-white">Cover</span>}
          </li>
        ))}
        {images.length < MAX_PRODUCT_IMAGES && (
          <li>
            <label className={cn("flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/20 text-ink-400 transition-colors hover:border-sepia hover:text-sepia dark:border-white/20", uploading && "pointer-events-none opacity-60")}>
              <ImagePlus size={20} />
              <span className="mt-1 font-body text-[10px] uppercase tracking-wider">{uploading ? "Uploading…" : "Add"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} className="hidden" />
            </label>
          </li>
        )}
      </ul>
    </div>
  );
}

export function ProductsClient({ initialProducts, artworksWithoutProduct }: { initialProducts: ProductRow[]; artworksWithoutProduct: ArtworkOption[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [artworkPick, setArtworkPick] = useState("");
  useLockBodyScroll(modalOpen);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => (productTitle(p) ?? "").toLowerCase().includes(q) || (p.category ?? "").includes(q)) : products;
  }, [products, query]);
  const canReorder = query.trim() === "";

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setVariant(key: number, patch: Partial<VariantDraft>) {
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  }
  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setArtworkPick("");
    setModalOpen(true);
  }
  function openEdit(p: ProductRow) {
    setEditing(p);
    setForm({
      title: p.title ?? p.artwork?.title ?? "",
      description: p.description ?? p.artwork?.description ?? "",
      images: productImages(p),
      category: p.category ?? "",
      price: String(p.price),
      stock: String(p.stock),
      available: p.available,
      featured: p.featured,
      variants: p.variants.map((v) => ({ key: vKey++, label: v.label, price: String(v.price), stock: String(v.stock) })),
      artworkId: p.artworkId,
    });
    setModalOpen(true);
  }
  function applyArtwork(id: string) {
    setArtworkPick(id);
    const a = artworksWithoutProduct.find((x) => x.id === id);
    if (!a) {
      set("artworkId", null);
      return;
    }
    setForm((f) => ({
      ...f,
      artworkId: a.id,
      title: f.title || a.title,
      description: f.description || a.description || "",
      images: f.images.length ? f.images : [a.imageUrl],
    }));
  }

  async function save() {
    if (!form.title.trim() && !form.artworkId) return toast.error("Give the product a title.");
    if (form.price.trim() === "" || !Number.isFinite(Number(form.price))) return toast.error("Enter a price.");
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim() || null,
        description: form.description,
        images: form.images,
        category: form.category || null,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        available: form.available,
        featured: form.featured,
        variants: form.variants.map((v) => ({ label: v.label, price: v.price, stock: v.stock })),
        ...(editing ? {} : { artworkId: form.artworkId }),
      };
      const res = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product");
      setProducts((prev) => (editing ? prev.map((p) => (p.id === data.id ? data : p)) : [...prev, data]));
      toast.success(editing ? "Product updated" : "Product added");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save product"));
    } finally {
      setSaving(false);
    }
  }

  async function patchQuick(p: ProductRow, patch: Partial<Pick<ProductRow, "available" | "featured">>, label: string) {
    const prev = products;
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(label);
      router.refresh();
    } catch (err) {
      setProducts(prev);
      toast.error(getErrorMessage(err, "Failed to update"));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= products.length) return;
    const next = [...products];
    [next[index], next[j]] = [next[j], next[index]];
    setProducts(next.map((p, i) => ({ ...p, sortOrder: i })));
    try {
      const res = await fetch("/api/products/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: next.map((p, i) => ({ id: p.id, sortOrder: i })) }) });
      if (!res.ok) throw new Error("Failed to reorder");
      router.refresh();
    } catch (err) {
      setProducts(products);
      toast.error(getErrorMessage(err, "Failed to reorder"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setProducts((list) => list.filter((p) => p.id !== deleteTarget.id));
      toast.success(`"${productTitle(deleteTarget)}" moved to Trash`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className={cn(inputBase, "pl-9")} />
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sepia px-4 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark">
          <Plus size={16} /> New product
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="admin-card rounded-2xl border p-10 text-center">
          <Package size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">{products.length === 0 ? "Nothing in the store yet." : "Nothing matches that search."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p, index) => {
            const title = productTitle(p) ?? "Untitled";
            const cover = productImages(p)[0];
            const totalStock = p.variants.length ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
            return (
              <li key={p.id} className="admin-card flex gap-4 rounded-2xl border p-4">
                <button type="button" onClick={() => openEdit(p)} className="shrink-0" aria-label={`Edit ${title}`}>
                  {cover ? (
                    <SafeImg src={imageVariantUrl(cover, "thumb")} alt="" className="h-24 w-24 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-black/5 text-ink-300 dark:bg-white/5"><Package size={22} /></div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold text-ink dark:text-cream">{title}</p>
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                        {productCategoryLabel(p.category) ?? "Uncategorised"} · {formatPriceRange(p.price, p.variants.map((v) => v.price))}
                      </p>
                      <p className={cn("mt-1 font-body text-[11px]", totalStock === 0 ? "text-red-500" : "text-ink-400 dark:text-ink-300")}>
                        {totalStock === 0 ? "Sold out" : `${totalStock} in stock`}
                        {p.variants.length > 0 && ` · ${p.variants.length} size${p.variants.length === 1 ? "" : "s"}`}
                      </p>
                      {p.artwork && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 font-body text-[10px] text-ink-400 dark:border-white/10 dark:text-ink-300">
                          <Link2 size={10} /> Artwork: {p.artwork.title}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => patchQuick(p, { featured: !p.featured }, p.featured ? "No longer featured" : "Featured in the Store")} title={p.featured ? "Featured" : "Feature"} className={cn("rounded-lg p-1.5 transition-colors", p.featured ? "text-amber-500 hover:bg-amber-500/10" : "text-ink-300 hover:bg-black/5 dark:hover:bg-white/5")}>
                        <Star size={16} fill={p.featured ? "currentColor" : "none"} />
                      </button>
                      <button type="button" onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><Pencil size={16} /></button>
                      <button type="button" onClick={() => setDeleteTarget(p)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-500" title="Move to Trash"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button type="button" onClick={() => patchQuick(p, { available: !p.available }, p.available ? "Paused — hidden from the Store" : "Back in the Store")} className={cn("rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wider", p.available ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-black/10 text-ink-400 dark:border-white/10 dark:text-ink-300")}>
                      {p.available ? "In store" : "Paused"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={!canReorder || index === 0} onClick={() => move(index, -1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move up"><ArrowUp size={14} /></button>
                      <button type="button" disabled={!canReorder || index === visible.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move down"><ArrowDown size={14} /></button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => !saving && setModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={editing ? "Edit product" : "New product"} onClick={(e) => e.stopPropagation()} className="admin-modal flex max-h-[95vh] w-full max-w-4xl flex-col rounded-t-2xl border sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
              <h2 className="font-body text-base font-semibold text-ink dark:text-cream">{editing ? "Edit product" : "New product"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="space-y-5">
                  <PhotosField images={form.images} onChange={(v) => set("images", v)} />
                  {!editing && artworksWithoutProduct.length > 0 && (
                    <SelectField
                      label="Create from artwork"
                      value={artworkPick}
                      onChange={applyArtwork}
                      options={[{ value: "", label: "— no —" }, ...artworksWithoutProduct.map((a) => ({ value: a.id, label: a.title }))]}
                      hint="Optional. Starts the product from a gallery piece and hangs it in the Museum's Services Room."
                    />
                  )}
                  {editing?.artwork && (
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300">Linked to artwork <strong className="font-medium">{editing.artwork.title}</strong> — it hangs in the Services Room.</p>
                  )}
                  <ToggleRow label="In store" value={form.available} onChange={(v) => set("available", v)} words={{ on: "in store", off: "paused" }} />
                  <ToggleRow label="Featured" description="First in the Store and the homepage strip." value={form.featured} onChange={(v) => set("featured", v)} words={{ on: "featured", off: "not featured" }} />
                </div>
                <div className="space-y-5">
                  <TextField label="Title" value={form.title} onChange={(v) => set("title", v)} maxLength={MAX_PRODUCT_TITLE} placeholder="Tour shirt, black" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <SelectField label="Category" value={form.category} onChange={(v) => set("category", v)} options={CATEGORY_OPTIONS} />
                    <div>
                      <FieldLabel>Price (₱)</FieldLabel>
                      <input type="number" min={0} step="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="850" className={inputBase} />
                    </div>
                    <div>
                      <FieldLabel hint={form.variants.length ? "per size below" : undefined}>Stock</FieldLabel>
                      <input type="number" min={0} step="1" value={form.stock} onChange={(e) => set("stock", e.target.value)} disabled={form.variants.length > 0} className={cn(inputBase, "disabled:opacity-50")} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel hint={`${form.description.length}/${MAX_PRODUCT_DESCRIPTION}`}>Description</FieldLabel>
                    <textarea value={form.description} onChange={(e) => set("description", e.target.value.slice(0, MAX_PRODUCT_DESCRIPTION))} rows={5} placeholder="Fabric, print, sizing notes, what's included." className={cn(inputBase, "resize-y")} />
                  </div>
                  <div className="border-t border-black/10 pt-5 dark:border-white/10">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">Sizes / formats</p>
                      <button type="button" onClick={() => set("variants", [...form.variants, { ...newVariant(), price: form.price }])} className="inline-flex items-center gap-1 font-body text-xs text-sepia hover:underline">
                        <Plus size={14} /> Add
                      </button>
                    </div>
                    {form.variants.length === 0 ? (
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300">None — one price and one stock count for the whole product.</p>
                    ) : (
                      <ul className="space-y-2">
                        {form.variants.map((v) => (
                          <li key={v.key} className="grid grid-cols-[minmax(0,1fr)_6rem_5rem_2rem] items-center gap-2">
                            <input type="text" value={v.label} onChange={(e) => setVariant(v.key, { label: e.target.value })} placeholder="S / M / L · 12″ vinyl" className={inputBase} />
                            <input type="number" min={0} value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value })} placeholder="₱" className={inputBase} aria-label="Price" />
                            <input type="number" min={0} value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value })} placeholder="Qty" className={inputBase} aria-label="Stock" />
                            <button type="button" onClick={() => set("variants", form.variants.filter((x) => x.key !== v.key))} className="rounded p-1 text-ink-400 hover:text-red-500" aria-label="Remove"><X size={14} /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {editing?.slug && <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">/shop/{editing.slug}</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-black/10 px-6 py-4 dark:border-white/10">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-xl px-4 py-2.5 font-body text-sm text-ink-400 hover:text-ink dark:hover:text-cream">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-sepia px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Add product"}</button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmModal
        open={deleteTarget !== null}
        title="Move to Trash?"
        description={deleteTarget ? `"${productTitle(deleteTarget)}" leaves the Store. Past orders keep its name and picture. You can restore it from Trash.` : undefined}
        confirmLabel="Move to Trash"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
