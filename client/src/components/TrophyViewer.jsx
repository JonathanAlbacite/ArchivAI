import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// TrophyViewer.jsx
//
// Shows one trophy model (.glb) turning slowly, with three.js - the same way the character preview
// works (see CharacterCustomizer3D.jsx). `src` is the model's full address. The model is centred and
// scaled to fit the box, so any trophy the admin uploads is framed the same, whatever size it was
// made at. Give the component a `key` of its `src`, so a replaced trophy loads fresh.
// `bare` shows the trophy with no background or rounded frame (the results page uses it).

const FIELD_OF_VIEW = 35;

function TrophyViewer({ src, height = 220, label = "Trophy preview", bare = false }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    const container = containerRef.current;
    let disposed = false;
    let frame = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // The model sits inside this group, which is the part that turns.
    const pivot = new THREE.Group();
    scene.add(pivot);

    const resize = () => {
      const width = container.clientWidth || 1;
      const heightPx = container.clientHeight || 1;
      renderer.setSize(width, heightPx, false);
      camera.aspect = width / heightPx;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    new GLTFLoader().load(
      src,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
        model.position.sub(center);
        pivot.add(model);
        // Far enough back that the whole model fits, with a little room around it.
        const distance = (radius / Math.sin(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2))) * 1.1;
        camera.position.set(0, radius * 0.25, distance);
        camera.lookAt(0, 0, 0);
        setStatus("ready");
      },
      undefined,
      () => {
        if (!disposed) setStatus("error");
      }
    );

    const tick = () => {
      pivot.rotation.y += 0.01;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value && value.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [src]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      style={{ position: "relative", width: "100%", height, borderRadius: bare ? 0 : "var(--radius-md, 12px)", background: bare ? "transparent" : "var(--color-surface-muted)", overflow: "hidden" }}
    >
      {status !== "ready" && (
        <p className="text-sm text-muted" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", margin: 0, textAlign: "center", padding: 12 }}>
          {status === "loading" ? "Loading the model..." : "The model couldn't be loaded."}
        </p>
      )}
    </div>
  );
}

export default TrophyViewer;
