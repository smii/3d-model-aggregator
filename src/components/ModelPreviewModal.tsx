"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert, X } from "lucide-react";

interface ModelPreviewModalProps {
  open: boolean;
  modelTitle: string | null;
  platform: string | null;
  externalId: string | null;
  onClose: () => void;
}

type ViewerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

// Loads three.js and its loaders lazily (they're sizeable and only needed
// when a preview is actually opened) and renders the mesh into a plain div
// via a ref -- no react-three-fiber, just direct three.js scene setup torn
// down on close.
export function ModelPreviewModal({
  open,
  modelTitle,
  platform,
  externalId,
  onClose,
}: ModelPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewerState>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !platform || !externalId) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setState({ status: "loading" });

    (async () => {
      try {
        const params = new URLSearchParams({ platform, externalId });
        const response = await fetch(`/api/preview?${params}`);
        const data: { fileUrl?: string; format?: string; error?: string } =
          await response.json();
        if (!response.ok || !data.fileUrl) {
          throw new Error(data.error ?? `Preview lookup failed (${response.status}).`);
        }
        if (cancelled) return;

        const [THREE, { OrbitControls }, { STLLoader }, { ThreeMFLoader }] =
          await Promise.all([
            import("three"),
            import("three/examples/jsm/controls/OrbitControls.js"),
            import("three/examples/jsm/loaders/STLLoader.js"),
            import("three/examples/jsm/loaders/3MFLoader.js"),
          ]);
        if (cancelled) return;

        const geometry = await new Promise<import("three").BufferGeometry>(
          (resolve, reject) => {
            if (data.format === "3mf") {
              new ThreeMFLoader().load(
                data.fileUrl!,
                (group) => {
                  const mesh = group.children.find(
                    (child): child is import("three").Mesh =>
                      (child as import("three").Mesh).isMesh === true
                  );
                  if (!mesh) {
                    reject(new Error("3MF file contained no mesh."));
                    return;
                  }
                  resolve(mesh.geometry);
                },
                undefined,
                reject
              );
            } else {
              new STLLoader().load(data.fileUrl!, resolve, undefined, reject);
            }
          }
        );
        if (cancelled) return;

        geometry.computeVertexNormals();
        geometry.center();
        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere?.radius || 1;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x18181b);

        const width = container.clientWidth;
        const height = container.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, radius * 100);
        camera.position.set(0, 0, radius * 2.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const material = new THREE.MeshStandardMaterial({
          color: 0x818cf8,
          metalness: 0.1,
          roughness: 0.6,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
        keyLight.position.set(radius, radius, radius);
        scene.add(keyLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        let frameId = 0;
        const animate = () => {
          frameId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        setState({ status: "ready" });

        cleanup = () => {
          cancelAnimationFrame(frameId);
          window.removeEventListener("resize", onResize);
          controls.dispose();
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === container) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [open, platform, externalId]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="3D preview"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg shadow-black/40">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-3">
          <h2 className="truncate text-sm font-medium text-zinc-200">
            {modelTitle ?? "3D preview"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative flex-1">
          <div ref={containerRef} className="absolute inset-0" />

          {state.status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950">
              <Loader2 className="size-8 animate-spin text-indigo-500" />
              <p className="text-sm text-zinc-500">Loading model…</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 px-6 text-center">
              <TriangleAlert className="size-8 text-rose-500" />
              <p className="text-sm text-zinc-400">{state.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
