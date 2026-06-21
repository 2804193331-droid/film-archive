"use client";

import { motion } from "framer-motion";
import { SakuraLogo } from "@/components/sakura-logo";
import styles from "./auth-brand-panel.module.css";

export function AuthBrandPanel() {
  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, x: -48 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <SakuraLogo showName />
      </motion.div>
      <motion.div
        className={styles.signature}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.18 }}
      >
        <span>FILM · LIGHT · MEMORY</span>
        <span>EST. 2026</span>
      </motion.div>
    </motion.div>
  );
}
