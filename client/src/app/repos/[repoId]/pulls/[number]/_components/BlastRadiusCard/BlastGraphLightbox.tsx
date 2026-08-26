"use client";

import React from "react";
import { BlastGraph } from "./BlastGraph";

interface BlastGraphLightboxProps {
  impactedEndpoints: string[];
  open: boolean;
  onClose: () => void;
}

export function BlastGraphLightbox({ impactedEndpoints, open, onClose }: BlastGraphLightboxProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Blast radius graph"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-surface, #fff)",
          borderRadius: 12,
          padding: 28,
          minWidth: 340,
          maxWidth: 600,
          width: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "var(--text-muted)",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            margin: "0 0 16px 0",
            color: "var(--text-primary, inherit)",
          }}
        >
          Blast Radius Graph
        </p>
        <BlastGraph impactedEndpoints={impactedEndpoints} />
      </div>
    </div>
  );
}
