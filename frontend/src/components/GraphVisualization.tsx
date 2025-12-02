"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { VisualizationStep, GraphData, GraphNode, GraphEdge, OPERATION_COLORS } from "@/types/visualization";

interface GraphVisualizationProps {
  scene: THREE.Scene | null;
  data: GraphData | null;
  currentStep: VisualizationStep | null;
  is3D: boolean;
}

// Simple force-directed layout calculation
function calculateForceLayout(nodes: GraphNode[], edges: GraphEdge[], iterations: number = 50): GraphNode[] {
  // Initialize positions randomly if not set
  const layoutNodes = nodes.map((node) => ({
    ...node,
    x: node.x ?? (Math.random() - 0.5) * 10,
    y: node.y ?? (Math.random() - 0.5) * 10,
    z: node.z ?? (Math.random() - 0.5) * 5,
    vx: 0,
    vy: 0,
    vz: 0,
  }));

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // Force simulation parameters
  const repulsion = 5;
  const attraction = 0.1;
  const damping = 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const nodeA = layoutNodes[i];
        const nodeB = layoutNodes[j];

        const dx = nodeB.x! - nodeA.x!;
        const dy = nodeB.y! - nodeA.y!;
        const dz = nodeB.z! - nodeA.z!;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        nodeA.vx! -= fx;
        nodeA.vy! -= fy;
        nodeA.vz! -= fz;
        nodeB.vx! += fx;
        nodeB.vy! += fy;
        nodeB.vz! += fz;
      }
    }

    // Attraction along edges
    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;

      const dx = target.x! - source.x!;
      const dy = target.y! - source.y!;
      const dz = target.z! - source.z!;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

      const force = dist * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;

      source.vx! += fx;
      source.vy! += fy;
      source.vz! += fz;
      target.vx! -= fx;
      target.vy! -= fy;
      target.vz! -= fz;
    });

    // Apply velocities and damping
    layoutNodes.forEach((node) => {
      node.x! += node.vx! * damping;
      node.y! += node.vy! * damping;
      node.z! += node.vz! * damping;
      node.vx! *= damping;
      node.vy! *= damping;
      node.vz! *= damping;
    });
  }

  return layoutNodes.map(({ vx, vy, vz, ...node }) => node);
}

export default function GraphVisualization({ scene, data, currentStep, is3D }: GraphVisualizationProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<GraphNode[]>([]);

  // Get highlighted node IDs from current step
  const highlightedIds = useMemo(() => {
    if (!currentStep) return new Set<string>();
    return new Set(currentStep.indices.map((i) => i.toString()));
  }, [currentStep]);

  // Get color for a node based on current operation
  const getColorForNode = (nodeId: string): string => {
    if (!currentStep || !highlightedIds.has(nodeId)) {
      return OPERATION_COLORS.default;
    }
    return OPERATION_COLORS[currentStep.operation] || OPERATION_COLORS.default;
  };

  // Calculate layout when data changes
  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) {
      setLayoutNodes([]);
      return;
    }
    const layout = calculateForceLayout(data.nodes, data.edges || []);
    setLayoutNodes(layout);
  }, [data]);

  // 3D Rendering with Three.js
  useEffect(() => {
    if (!is3D || !scene || layoutNodes.length === 0 || !data) return;

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
    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

    // Create edges first (so nodes render on top)
    (data.edges || []).forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;

      const fromPos = new THREE.Vector3(source.x || 0, source.y || 0, source.z || 0);
      const toPos = new THREE.Vector3(target.x || 0, target.y || 0, target.z || 0);

      const isEdgeHighlighted = highlightedIds.has(source.id) && highlightedIds.has(target.id);

      const points = [fromPos, toPos];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: isEdgeHighlighted ? new THREE.Color(OPERATION_COLORS.visit) : new THREE.Color(0x666666),
        linewidth: isEdgeHighlighted ? 3 : 1,
      });

      const line = new THREE.Line(geometry, material);
      group.add(line);
    });

    // Create nodes as spheres
    layoutNodes.forEach((node) => {
      const geometry = new THREE.SphereGeometry(0.5, 32, 32);
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
        sprite.position.set(node.x || 0, (node.y || 0) + 0.8, (node.z || 0) + 0.1);
        sprite.scale.set(1, 0.5, 1);
        group.add(sprite);
      }
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
  }, [is3D, scene, layoutNodes, data, currentStep, highlightedIds]);

  // 2D Fallback Rendering
  if (!is3D) {
    if (!data || layoutNodes.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-text-muted">No graph data to visualize</p>
        </div>
      );
    }

    // Calculate bounds for scaling
    const minX = Math.min(...layoutNodes.map((n) => n.x || 0));
    const maxX = Math.max(...layoutNodes.map((n) => n.x || 0));
    const minY = Math.min(...layoutNodes.map((n) => n.y || 0));
    const maxY = Math.max(...layoutNodes.map((n) => n.y || 0));

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    const scaleX = (x: number) => ((x - minX) / width) * 80 + 10;
    const scaleY = (y: number) => ((y - minY) / height) * 80 + 10;

    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

    return (
      <div className="w-full h-full relative">
        {/* SVG for edges */}
        <svg className="absolute inset-0 w-full h-full">
          {(data.edges || []).map((edge, index) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const isEdgeHighlighted = highlightedIds.has(source.id) && highlightedIds.has(target.id);

            return <line key={index} x1={`${scaleX(source.x || 0)}%`} y1={`${scaleY(source.y || 0)}%`} x2={`${scaleX(target.x || 0)}%`} y2={`${scaleY(target.y || 0)}%`} stroke={isEdgeHighlighted ? OPERATION_COLORS.visit : "#666666"} strokeWidth={isEdgeHighlighted ? 3 : 2} className="transition-all duration-300" />;
          })}
        </svg>

        {/* Nodes */}
        {layoutNodes.map((node) => {
          const color = getColorForNode(node.id);
          const isHighlighted = highlightedIds.has(node.id);

          return (
            <div
              key={node.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-300 ${isHighlighted ? "scale-125" : ""}`}
              style={{
                left: `${scaleX(node.x || 0)}%`,
                top: `${scaleY(node.y || 0)}%`,
                width: "44px",
                height: "44px",
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
