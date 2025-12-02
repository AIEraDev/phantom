"use client";

import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { VisualizationStep, TreeNode, OPERATION_COLORS } from "@/types/visualization";

interface TreeVisualizationProps {
  scene: THREE.Scene | null;
  data: TreeNode | null;
  currentStep: VisualizationStep | null;
  is3D: boolean;
}

// Calculate tree layout positions
function calculateTreeLayout(node: TreeNode, depth: number = 0, position: number = 0, spacing: number = 2): TreeNode {
  const layoutNode: TreeNode = {
    ...node,
    x: position,
    y: -depth * 2,
    z: 0,
    children: [],
  };

  if (node.children && node.children.length > 0) {
    const childCount = node.children.length;
    const totalWidth = (childCount - 1) * spacing;
    const startX = position - totalWidth / 2;

    layoutNode.children = node.children.map((child, index) => {
      return calculateTreeLayout(child, depth + 1, startX + index * spacing, spacing / 1.5);
    });
  }

  return layoutNode;
}

// Flatten tree to array for rendering
function flattenTree(node: TreeNode): TreeNode[] {
  const nodes: TreeNode[] = [node];
  if (node.children) {
    node.children.forEach((child) => {
      nodes.push(...flattenTree(child));
    });
  }
  return nodes;
}

// Get edges from tree
function getTreeEdges(node: TreeNode): { from: TreeNode; to: TreeNode }[] {
  const edges: { from: TreeNode; to: TreeNode }[] = [];
  if (node.children) {
    node.children.forEach((child) => {
      edges.push({ from: node, to: child });
      edges.push(...getTreeEdges(child));
    });
  }
  return edges;
}

export default function TreeVisualization({ scene, data, currentStep, is3D }: TreeVisualizationProps) {
  const groupRef = useRef<THREE.Group | null>(null);

  // Get highlighted node IDs from current step
  const highlightedIds = useMemo(() => {
    if (!currentStep) return new Set<string>();
    // Indices in tree context are node IDs
    return new Set(currentStep.indices.map((i) => i.toString()));
  }, [currentStep]);

  // Get color for a node based on current operation
  const getColorForNode = (nodeId: string): string => {
    if (!currentStep || !highlightedIds.has(nodeId)) {
      return OPERATION_COLORS.default;
    }
    return OPERATION_COLORS[currentStep.operation] || OPERATION_COLORS.default;
  };

  // Calculate layout
  const layoutData = useMemo(() => {
    if (!data) return null;
    return calculateTreeLayout(data);
  }, [data]);

  const flatNodes = useMemo(() => {
    if (!layoutData) return [];
    return flattenTree(layoutData);
  }, [layoutData]);

  const edges = useMemo(() => {
    if (!layoutData) return [];
    return getTreeEdges(layoutData);
  }, [layoutData]);

  // 3D Rendering with Three.js
  useEffect(() => {
    if (!is3D || !scene || !layoutData) return;

    // Clear previous group
    if (groupRef.current) {
      scene.remove(groupRef.current);
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          if ("geometry" in child) child.geometry.dispose();
          if ("material" in child && child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }

    const group = new THREE.Group();
    groupRef.current = group;

    // Create nodes as spheres
    flatNodes.forEach((node) => {
      const geometry = new THREE.SphereGeometry(0.4, 32, 32);
      const color = new THREE.Color(getColorForNode(node.id));
      const isHighlighted = highlightedIds.has(node.id);

      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: isHighlighted ? color : new THREE.Color(0x000000),
        emissiveIntensity: isHighlighted ? 0.5 : 0,
        shininess: 100,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.x || 0, node.y || 0, node.z || 0);
      mesh.userData = { id: node.id, value: node.value };
      group.add(mesh);

      // Add value label
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 64;
        canvas.height = 32;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.value), 32, 16);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(node.x || 0, (node.y || 0) + 0.7, (node.z || 0) + 0.1);
        sprite.scale.set(1, 0.5, 1);
        group.add(sprite);
      }
    });

    // Create edges as tubes
    edges.forEach(({ from, to }) => {
      const fromPos = new THREE.Vector3(from.x || 0, from.y || 0, from.z || 0);
      const toPos = new THREE.Vector3(to.x || 0, to.y || 0, to.z || 0);

      const path = new THREE.LineCurve3(fromPos, toPos);
      const geometry = new THREE.TubeGeometry(path, 1, 0.05, 8, false);

      const isEdgeHighlighted = highlightedIds.has(from.id) && highlightedIds.has(to.id);
      const material = new THREE.MeshPhongMaterial({
        color: isEdgeHighlighted ? new THREE.Color(OPERATION_COLORS.visit) : new THREE.Color(0x666666),
        emissive: isEdgeHighlighted ? new THREE.Color(OPERATION_COLORS.visit) : new THREE.Color(0x000000),
        emissiveIntensity: isEdgeHighlighted ? 0.3 : 0,
      });

      const tube = new THREE.Mesh(geometry, material);
      group.add(tube);
    });

    scene.add(group);

    return () => {
      if (groupRef.current && scene) {
        scene.remove(groupRef.current);
        groupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            if ("geometry" in child) child.geometry.dispose();
            if ("material" in child && child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [is3D, scene, layoutData, flatNodes, edges, currentStep, highlightedIds]);

  // 2D Fallback Rendering
  if (!is3D) {
    if (!layoutData || flatNodes.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-text-muted">No tree data to visualize</p>
        </div>
      );
    }

    // Calculate bounds for scaling
    const minX = Math.min(...flatNodes.map((n) => n.x || 0));
    const maxX = Math.max(...flatNodes.map((n) => n.x || 0));
    const minY = Math.min(...flatNodes.map((n) => n.y || 0));
    const maxY = Math.max(...flatNodes.map((n) => n.y || 0));

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    const scaleX = (x: number) => ((x - minX) / width) * 80 + 10; // 10-90% of container
    const scaleY = (y: number) => ((y - minY) / height) * 80 + 10;

    return (
      <div className="w-full h-full relative">
        {/* SVG for edges */}
        <svg className="absolute inset-0 w-full h-full">
          {edges.map(({ from, to }, index) => {
            const isEdgeHighlighted = highlightedIds.has(from.id) && highlightedIds.has(to.id);
            return <line key={index} x1={`${scaleX(from.x || 0)}%`} y1={`${scaleY(from.y || 0)}%`} x2={`${scaleX(to.x || 0)}%`} y2={`${scaleY(to.y || 0)}%`} stroke={isEdgeHighlighted ? OPERATION_COLORS.visit : "#666666"} strokeWidth={isEdgeHighlighted ? 3 : 2} className="transition-all duration-300" />;
          })}
        </svg>

        {/* Nodes */}
        {flatNodes.map((node) => {
          const color = getColorForNode(node.id);
          const isHighlighted = highlightedIds.has(node.id);

          return (
            <div
              key={node.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-300 ${isHighlighted ? "scale-125" : ""}`}
              style={{
                left: `${scaleX(node.x || 0)}%`,
                top: `${scaleY(node.y || 0)}%`,
                width: "40px",
                height: "40px",
                backgroundColor: color,
                boxShadow: isHighlighted ? `0 0 15px ${color}` : "none",
              }}
            >
              <span className="text-sm font-bold text-white font-code">{node.value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
