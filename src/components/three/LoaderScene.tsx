"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface LoaderSceneProps {
  className?: string;
}

export function LoaderScene({ className = "" }: LoaderSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ringGeometry = new THREE.TorusGeometry(1.4, 0.06, 16, 80);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    scene.add(ring);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.04, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x15803d, transparent: true, opacity: 0.6 })
    );
    scene.add(innerRing);

    const particleCount = 60;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 1.6 + Math.random() * 0.3;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x4ade80,
      size: 0.08,
      transparent: true,
      opacity: 0.9,
    });
    const orbitParticles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(orbitParticles);

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      ring.rotation.x = t * 0.8;
      ring.rotation.y = t * 1.1;
      innerRing.rotation.x = -t * 0.6;
      innerRing.rotation.z = t * 0.9;
      orbitParticles.rotation.z = -t * 0.5;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      ringGeometry.dispose();
      ringMaterial.dispose();
      innerRing.geometry.dispose();
      (innerRing.material as THREE.Material).dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
}
