"use client";

import { motion } from "framer-motion";
import { SakuraLogo } from "@/components/sakura-logo";
import styles from "./auth-brand-panel.module.css";

export function AuthBrandPanel() {
  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, x: -44 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.58, ease: [0.19, 1, 0.22, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.52, delay: 0.08, ease: [0.19, 1, 0.22, 1] }}
      >
        <SakuraLogo showName animate />
      </motion.div>
      <motion.div
        className={styles.signature}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.44 }}
      >
        <span>FILM / LIGHT / MEMORY</span>
        <span>EST. 2026</span>
      </motion.div>
    </motion.div>
  );
}
