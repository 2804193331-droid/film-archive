"use client";

import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { Check, LoaderCircle, LocateFixed, MapPin, Search, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./location-picker.module.css";

type Coordinates = {
  lat: number;
  lon: number;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

type LocationPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

function formatLocation(result: NominatimResult) {
  const address = result.address ?? {};
  const values = [
    address.state,
    address.city || address.town || address.village,
    address.city_district || address.county,
    address.suburb || address.road
  ].filter(Boolean);

  return Array.from(new Set(values)).join(" · ") || result.display_name;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const coordinatesRef = useRef<Coordinates | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mapHostRef.current) return;

    let disposed = false;

    async function setupMap() {
      const L = await import("leaflet");
      if (disposed || !mapHostRef.current) return;

      leafletRef.current = L;
      const currentCoordinates = coordinatesRef.current;
      const initial: [number, number] = currentCoordinates ? [currentCoordinates.lat, currentCoordinates.lon] : [31.2304, 121.4737];
      const map = L.map(mapHostRef.current, { zoomControl: false }).setView(initial, currentCoordinates ? 13 : 4);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      if (currentCoordinates) {
        markerRef.current = L.circleMarker(initial, {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#ff5a4e",
          fillOpacity: 1
        }).addTo(map);
      }

      map.on("click", async (event) => {
        const point = { lat: event.latlng.lat, lon: event.latlng.lng };
        coordinatesRef.current = point;
        setError("");

        if (markerRef.current) {
          markerRef.current.setLatLng(event.latlng);
        } else {
          markerRef.current = L.circleMarker(event.latlng, {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#ff5a4e",
            fillOpacity: 1
          }).addTo(map);
        }

        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=zh-CN&lat=${point.lat}&lon=${point.lon}`,
            { signal: controller.signal }
          );
          if (!response.ok) throw new Error("reverse-geocode-failed");
          const result = (await response.json()) as NominatimResult;
          setSelectedLocation(formatLocation(result));
        } catch (requestError) {
          if ((requestError as Error).name !== "AbortError") {
            setSelectedLocation(`${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`);
            setError("地点名称暂时无法读取，已保留坐标。");
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      });

      window.setTimeout(() => map.invalidateSize(), 0);
    }

    void setupMap();
    return () => {
      disposed = true;
      requestRef.current?.abort();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [open]);

  function openPicker() {
    setQuery(value);
    setSelectedLocation(value);
    setError("");
    setOpen(true);
  }

  function showPoint(point: Coordinates, zoom = 15) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const latLng: [number, number] = [point.lat, point.lon];
    map.setView(latLng, zoom);
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      markerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#ff5a4e",
        fillOpacity: 1
      }).addTo(map);
    }
  }

  async function searchLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=zh-CN&q=${encodeURIComponent(term)}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error("search-failed");
      const results = (await response.json()) as NominatimResult[];
      if (!results.length) {
        setError("没有找到这个地点，换个关键词试试。");
        return;
      }

      const result = results[0];
      const point = { lat: Number(result.lat), lon: Number(result.lon) };
      coordinatesRef.current = point;
      setSelectedLocation(formatLocation(result));
      showPoint(point);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") setError("地图搜索暂时不可用，请稍后再试。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("当前浏览器不支持定位。");
      return;
    }

    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        coordinatesRef.current = point;
        setSelectedLocation(`${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`);
        showPoint(point, 16);
        setLoading(false);
      },
      () => {
        setError("未能取得当前位置，你也可以直接在地图上点选。");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  function confirmLocation() {
    if (!selectedLocation.trim()) return;
    onChange(selectedLocation.trim());
    setOpen(false);
  }

  return (
    <>
      <div className={styles.inputGroup}>
        <input
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="输入地点或从地图选择"
        />
        <button type="button" className={styles.mapButton} onClick={openPicker} title="地图选择" aria-label="地图选择" data-testid="location-map-button">
          <MapPin size={17} aria-hidden />
        </button>
      </div>

      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="location-picker-title" data-testid="location-map-dialog">
            <header className={styles.dialogHeader}>
              <div>
                <h2 id="location-picker-title">选择拍摄地点</h2>
                <p>搜索地点，或直接在地图上点选。</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setOpen(false)} title="关闭" aria-label="关闭地图">
                <X size={18} aria-hidden />
              </button>
            </header>

            <form className={styles.searchBar} onSubmit={searchLocation}>
              <Search size={17} aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索城市、街道或地点" aria-label="搜索地图地点" />
              <button type="submit" disabled={loading || !query.trim()}>
                搜索
              </button>
            </form>

            <div className={styles.mapWrap}>
              <div ref={mapHostRef} className={styles.map} aria-label="地点地图" />
              <button type="button" className={styles.locateButton} onClick={useCurrentLocation} title="使用当前位置" aria-label="使用当前位置">
                <LocateFixed size={18} aria-hidden />
              </button>
              {loading ? (
                <div className={styles.loading} aria-live="polite">
                  <LoaderCircle size={17} aria-hidden />
                  正在查找
                </div>
              ) : null}
            </div>

            <footer className={styles.dialogFooter}>
              <div className={styles.selection} aria-live="polite">
                <MapPin size={17} aria-hidden />
                <span>{selectedLocation || "还没有选择地点"}</span>
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.footerActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setOpen(false)}>
                  取消
                </button>
                <button type="button" className={styles.confirmButton} onClick={confirmLocation} disabled={!selectedLocation.trim()}>
                  <Check size={16} aria-hidden />
                  使用此地点
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
