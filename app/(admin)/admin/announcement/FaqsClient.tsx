// app/(admin)/admin/announcement/FaqsClient.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  MessageCircleQuestion,
} from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { getErrorMessage } from "@/lib/utils";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  question: string;
  answer: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  question: "",
  answer: "",
  isActive: true,
};

export function FaqsClient({ initialFaqs }: { initialFaqs: Faq[] }) {
  const router = useRouter();
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs);

  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  function openDeleteConfirm(id: string) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(id);
  }
  const [validationError, setValidationError] = useState<string | null>(null);

  const isReorderingAllowed = searchQuery.trim() === "";

  const processedFaqs = useMemo(() => {
    const sorted = [...faqs].sort((a, b) => a.displayOrder - b.displayOrder);
    if (searchQuery.trim() === "") return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  useEffect(() => {
    if (showModal || deleteConfirm) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModal, deleteConfirm]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setValidationError(null);
    setShowModal(true);
  }

  function openEdit(item: Faq) {
    setEditing(item);
    setForm({
      question: item.question,
      answer: item.answer,
      isActive: item.isActive,
    });
    setValidationError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!form.question.trim() || !form.answer.trim()) {
      setValidationError("Both question and answer are required.");
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        const res = await fetch(`/api/faqs/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to update FAQ");
        }
        const data = await res.json();
        setFaqs((prev) => prev.map((f) => (f.id === editing.id ? data : f)));
        toast.success("FAQ updated");
      } else {
        const res = await fetch("/api/faqs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create FAQ");
        }
        const data = await res.json();
        setFaqs((prev) => [...prev, data]);
        toast.success("FAQ created");
      }
      setShowModal(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(item: Faq) {
    const updatedState = !item.isActive;
    setFaqs((prev) => prev.map((f) => (f.id === item.id ? { ...f, isActive: updatedState } : f)));

    try {
      const res = await fetch(`/api/faqs/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: updatedState }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      toast.success(updatedState ? "FAQ activated" : "FAQ deactivated");
      router.refresh();
    } catch {
      setFaqs((prev) => prev.map((f) => (f.id === item.id ? { ...f, isActive: item.isActive } : f)));
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/faqs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setFaqs((prev) => prev.filter((f) => f.id !== id));
      toast.success("FAQ deleted");
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete FAQ");
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    if (!isReorderingAllowed) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= processedFaqs.length) return;

    const reordered = [...processedFaqs];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const order = reordered.map((f, i) => ({ id: f.id, displayOrder: i }));

    setFaqs(reordered.map((f, i) => ({ ...f, displayOrder: i })));

    try {
      const res = await fetch("/api/faqs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Failed to reorder");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          New FAQ
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Total FAQs: <strong className="text-ink dark:text-cream">{faqs.length}</strong>{" "}
          &middot; Active:{" "}
          <strong className="text-ink dark:text-cream">{faqs.filter((f) => f.isActive).length}</strong>
        </div>
      </div>

      {/* Search Bar */}
      <div className="admin-card border rounded-2xl p-4 flex items-center gap-3 backdrop-blur-md shadow-sm">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search question or answer..."
            className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink dark:hover:text-cream"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {!isReorderingAllowed && (
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 hidden sm:block">
            Clear search to enable manual reordering
          </p>
        )}
      </div>

      {/* FAQs List */}
      {processedFaqs.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <MessageCircleQuestion className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-ink dark:text-cream mb-1">
              {faqs.length === 0 ? "No FAQs yet" : "No matching FAQs"}
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {faqs.length === 0
                ? "Add your first question & answer to populate the public FAQ chatbox."
                : "Try adjusting your search query."}
            </p>
            {faqs.length === 0 ? (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all"
              >
                <Plus size={16} />
                Create FAQ
              </button>
            ) : (
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium"
              >
                Reset Search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold w-20">Order</th>
                  <th className="py-4 px-6 font-semibold">Question &amp; Answer</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {processedFaqs.map((item, index) => (
                  <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    {/* Reorder */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={!isReorderingAllowed || index === 0}
                          title={isReorderingAllowed ? "Move up" : "Clear search to reorder"}
                          className="p-1 rounded-md bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={!isReorderingAllowed || index === processedFaqs.length - 1}
                          title={isReorderingAllowed ? "Move down" : "Clear search to reorder"}
                          className="p-1 rounded-md bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Question & Answer */}
                    <td className="py-4 px-6 max-w-xl">
                      <div
                        onClick={() => openEdit(item)}
                        className="font-semibold text-ink dark:text-cream cursor-pointer hover:underline"
                      >
                        {item.question}
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-300 line-clamp-2 mt-0.5">
                        {item.answer}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {item.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(item)}
                          type="button"
                          title={item.isActive ? "Deactivate" : "Activate"}
                          className={`p-2 rounded-lg transition-colors ${item.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                            }`}
                        >
                          {item.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>

                        <button
                          onClick={() => openEdit(item)}
                          title="Edit"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => openDeleteConfirm(item.id)}
                          title="Delete"
                          className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <h2 className="text-xl font-jakarta font-semibold text-ink dark:text-cream">
                {editing ? "Edit FAQ" : "Create New FAQ"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form id="faq-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {validationError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm font-jakarta">
                  {validationError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Question <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. What products are currently available?"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Answer <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Enter the response visitors will see..."
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm font-medium text-ink dark:text-cream">
                  Active (visible in the public FAQ chatbox)
                </span>
              </label>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="faq-form"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {loading ? "Saving..." : editing ? "Save Changes" : "Create FAQ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">Delete FAQ</h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
