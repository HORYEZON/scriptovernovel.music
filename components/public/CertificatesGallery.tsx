"use client";

import { useState, useEffect } from "react";
import Image from "@/components/ui/SafeImage";
import { X } from "lucide-react";
import type { CertificateAward } from "@prisma/client";
import { imageVariantUrl } from "@/lib/images/variants";

export function CertificatesGallery({
    certificates,
}: {
    certificates: CertificateAward[];
}) {
    const [selectedCert, setSelectedCert] = useState<CertificateAward | null>(null);

    // Close modal on ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedCert(null);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    // Lock body scroll while modal is open
    useEffect(() => {
        document.body.style.overflow = selectedCert ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [selectedCert]);

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {certificates.map((cert) => (
                    <div
                        key={cert.id}
                        className="group relative bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden transition-all duration-500 hover:border-sepia-light/60 hover:bg-white/[0.06] hover:-translate-y-1 hover:shadow-[0_14px_40px_-12px_rgba(200,169,110,0.55)]"
                    >
                        {cert.imageUrl && (
                            <div
                                className="relative w-full h-40 overflow-hidden cursor-pointer"
                                onClick={() => setSelectedCert(cert)}
                            >
                                <Image
                                    src={imageVariantUrl(cert.imageUrl, "thumb")}
                                    alt={cert.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                                {/* Light sweep — same premium accent as Sections / Curator's Picks */}
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-sepia-light/25 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer pointer-events-none" />

                                {/* Zoom hint on hover */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300">
                                </div>
                            </div>
                        )}
                        <div className="p-5">
                            <h4 className="font-display text-lg font-light italic text-white leading-tight">
                                {cert.title}
                            </h4>
                            {cert.issuer && (
                                <p className="font-body text-xs text-sepia-light tracking-wide mt-1.5">
                                    {cert.issuer}
                                </p>
                            )}
                            {cert.dateAwarded && (
                                <p className="font-body text-[11px] text-white/40 mt-1">
                                    {new Date(cert.dateAwarded).toLocaleDateString("en-PH", {
                                        year: "numeric",
                                        month: "long",
                                    })}
                                </p>
                            )}
                            {cert.description && (
                                <p className="font-body text-xs text-white/50 leading-relaxed mt-3 line-clamp-3">
                                    {cert.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Fullscreen Image Modal */}
            {selectedCert && selectedCert.imageUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200"
                    onClick={() => setSelectedCert(null)}
                >
                    <button
                        onClick={() => setSelectedCert(null)}
                        className="absolute top-4 right-4 md:top-8 md:right-8 text-white/70 hover:text-white transition-colors z-10"
                        aria-label="Close"
                    >
                        <X size={28} strokeWidth={1.5} />
                    </button>

                    <div
                        className="relative max-w-5xl max-h-[85vh] w-full flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative w-full h-[70vh]">
                            <Image
                                src={selectedCert.imageUrl}
                                alt={selectedCert.title}
                                fill
                                className="object-contain"
                                sizes="90vw"
                            />
                        </div>

                        <div className="mt-6 text-center">
                            <h4 className="font-display text-xl font-light italic text-white">
                                {selectedCert.title}
                            </h4>
                            {selectedCert.issuer && (
                                <p className="font-body text-xs text-sepia-light tracking-wide mt-1.5">
                                    {selectedCert.issuer}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}