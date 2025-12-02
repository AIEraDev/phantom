"use client";

import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { VisualizationStep, OPERATION_COLORS } from "@/types/visualization";

interface ArrayVisualizationProps {
  scene: THREE.Scene | null;
  data: number[] | null;
  currentStep: VisualizationStep | null;
  is3D: boolean;
}

export default function ArrayVisualization({ scene, data, currentStep, is3D }: ArrayVisualizationProps) {
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group | null>(null);

  // Get highlighted indices from current step
  const highlightedIndices = useMemo(() => {
    if (!currentStep) return new Set<number>();
    return new Set(currentStep.indices);
  }, [currentStep]);

  // Get color for an index based on current operation
  const getColorForIndex = (index: number): string => {
    if (!currentStep || !highlightedIndices.has(index)) {
      return OPERATION_COLORS.default;
    }
    return OPERATION_COLORS[currentStep.operation] || OPERATION_COLORS.default;
  };

  // 3D Rendering with Three.js
  useEffect(() => {
    if (!is3D || !scene || !data || data.length === 0) return;

    // Clear previous meshes
    if (groupRef.current) {
      scene.remove(groupRef.current);
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }

    // Create new group
    const group = new THREE.Group();
    groupRef.current = group;
    meshesRef.current = [];

    // Calculate dimensions
    const maxValue = Math.max(...data, 1);
    const barWidth = 0.8;
    const spacing = 1;
    const totalWidth = data.length * spacing;
    const startX = -totalWidth / 2 + spacing / 2;

    // Create bars
    data.forEach((value, index) => {
      const height = (value / maxValue) * 5 + 0.1; // Scale height, min 0.1
      const geometry = new THREE.BoxGeometry(barWidth, height, barWidth);

      const color = new THREE.Color(getColorForIndex(index));
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: highlightedIndices.has(index) ? color : new THREE.Color(0x000000),
        emissiveIntensity: highlightedIndices.has(index) ? 0.3 : 0,
        shininess: 100,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(startX + index * spacing, height / 2, 0);
      mesh.userData = { index, value };

      group.add(mesh);
      meshesRef.current.push(mesh);

      // Add value label (using sprite)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 64;
        canvas.height = 32;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value.toString(), 32, 16);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(startX + index * spacing, height + 0.5, 0);
        sprite.scale.set(1, 0.5, 1);
        group.add(sprite);
      }
    });

    scene.add(group);

    return () => {
      if (groupRef.current && scene) {
        scene.remove(groupRef.current);
        groupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [is3D, scene, data, currentStep, highlightedIndices]);

  // Update colors when step changes (without recreating geometry)
  useEffect(() => {
    if (!is3D || !scene || meshesRef.current.length === 0) return;

    meshesRef.current.forEach((mesh, index) => {
      const material = mesh.material as THREE.MeshPhongMaterial;
      const color = new THREE.Color(getColorForIndex(index));
      material.color = color;
      material.emissive = highlightedIndices.has(index) ? color : new THREE.Color(0x000000);
      material.emissiveIntensity = highlightedIndices.has(index) ? 0.3 : 0;
    });
  }, [currentStep, highlightedIndices, is3D, scene]);

  // 2D Fallback Rendering
  if (!is3D) {
    if (!data || data.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-text-muted">No array data to visualize</p>
        </div>
      );
    }

    const maxValue = Math.max(...data, 1);

    return (
      <div className="w-full h-full flex items-end justify-center gap-1 p-4">
        {data.map((value, index) => {
          const heightPercent = (value / maxValue) * 100;
          const color = getColorForIndex(index);
          const isHighlighted = highlightedIndices.has(index);

          return (
            <div key={index} className="flex flex-col items-center gap-1" style={{ flex: "1 1 0", maxWidth: "60px" }}>
              {/* Value label */}
              <span className="text-xs text-text-secondary font-code">{value}</span>

              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all duration-300 ${isHighlighted ? "shadow-lg" : ""}`}
                style={{
                  height: `${Math.max(heightPercent, 5)}%`,
                  backgroundColor: color,
                  boxShadow: isHighlighted ? `0 0 10px ${color}` : "none",
                  minHeight: "10px",
                }}
              />

              {/* Index label */}
              <span className="text-xs text-text-muted font-code">{index}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // 3D mode renders via Three.js scene, return null for React
  return null;
}
