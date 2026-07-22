"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ParticleBackgroundProps {
  className?: string;
  particleCount?: number;
}

function useResponsiveParticleCount(defaultCount: number) {
  const [count, setCount] = useState(defaultCount);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < 640) setCount(Math.min(35, defaultCount));
      else if (width < 1024) setCount(Math.min(55, defaultCount));
      else setCount(defaultCount);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [defaultCount]);

  return count;
}

export function ParticleBackground({
  className = "",
  particleCount = 80,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCount = useResponsiveParticleCount(particleCount);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.z = 45;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const count = activeCount;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 80;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 40;
      seeds[i3] = Math.random() * Math.PI * 2;
      seeds[i3 + 1] = Math.random() * Math.PI * 2;
      seeds[i3 + 2] = 0.2 + Math.random() * 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x16a34a,
      size: 0.4,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.targetY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const speed = seeds[i3 + 2];
        posAttr.array[i3] =
          positions[i3] +
          Math.sin(elapsed * speed + seeds[i3]) * 2 +
          mouse.x * 5;
        posAttr.array[i3 + 1] =
          positions[i3 + 1] +
          Math.cos(elapsed * speed * 0.9 + seeds[i3 + 1]) * 2 +
          mouse.y * 4;
        posAttr.array[i3 + 2] =
          positions[i3 + 2] + Math.sin(elapsed * 0.3 + i * 0.1) * 1.5;
      }
      posAttr.needsUpdate = true;

      particles.rotation.y = elapsed * 0.015 + mouse.x * 0.1;
      particles.rotation.x = mouse.y * 0.06;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [activeCount]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
    />
  );
}
