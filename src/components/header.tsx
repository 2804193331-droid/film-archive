"use client";

import Link from "next/link";
import { Search, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthNav } from "@/components/auth-nav";
import styles from "./header.module.css";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/" className={styles.brand} aria-label="Film Archive 首页">
            Film Archive
          </Link>
          <nav className={styles.primaryNav} aria-label="主要导航">
            <Link href="/">首页</Link>
            <Link href="/explore">探索</Link>
            <Link href="/upload" className={styles.uploadLink} title="上传照片">
              <Upload size={15} aria-hidden />
              <span>上传</span>
            </Link>
          </nav>
        </div>

        <form action="/" className={styles.search} role="search">
          <Search size={17} aria-hidden />
          <input name="q" placeholder="搜索胶卷、地点、相机、镜头" />
        </form>

        <div className={styles.right}>
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
