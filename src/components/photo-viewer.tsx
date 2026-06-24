"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { RotatedImage } from "@/components/rotated-image";
import { normalizeRotation, rotatedAspectRatio } from "@/lib/rotation";
import styles from "./photo-viewer.module.css";

export function PhotoViewer({
  src,
  alt,
  rotation = 0,
  width,
  height
}: {
  src: string;
  alt: string;
  rotation?: number;
  width?: number;
  height?: number;
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const normalizedRotation = normalizeRotation(rotation);
  const aspect = width && height ? rotatedAspectRatio(width, height, normalizedRotation) : null;
  const ratio = aspect ? aspect.width / aspect.height : null;
  const stageStyle =
    ratio && ratio < 1
      ? ({
          width: `min(100%, ${Number((ratio * 76).toFixed(3))}vh)`
        } as CSSProperties)
      : undefined;
  const viewerStyle = {
    scale,
    "--viewer-width": ratio ? `min(94vw, ${Number((ratio * 92).toFixed(3))}vh, 1800px)` : "min(94vw, 1800px)"
  } as CSSProperties & { scale: number };

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setScale(1);
    }
  }, [open]);

  return (
    <>
      <button className={styles.stage} type="button" onClick={() => setOpen(true)} style={stageStyle}>
        <RotatedImage
          src={src}
          alt={alt}
          rotation={normalizedRotation}
          width={width}
          height={height}
          fit="contain"
          className={styles.stageImage}
        />
      </button>

      {open ? (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
        >
          <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="关闭">
            <X size={18} aria-hidden />
          </button>
          <motion.div
            className={styles.full}
            drag
            dragMomentum={false}
            style={viewerStyle}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.stopPropagation();
              setScale((value) => Math.min(4, Math.max(0.7, value - event.deltaY * 0.0015)));
            }}
          >
            <RotatedImage
              src={src}
              alt={alt}
              rotation={normalizedRotation}
              width={width}
              height={height}
              fit="contain"
              className={styles.fullImage}
              draggable={false}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </>
  );
}
