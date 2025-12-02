"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { SkillTreeNode, SkillTreeEdge } from "@/lib/api";
import { SkillTreeNodeComponent } from "./SkillTreeNode";

interface SkillTreeGraphProps {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
  onNodeClick: (node: SkillTreeNode) => void;
  selectedNodeId?: string;
  categoryFilter?: string;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 110;
const HORIZONTAL_GAP = 24;
const VERTICAL_GAP = 32;
const NODES_PER_ROW = 4;

export function SkillTreeGraph({ nodes, edges, onNodeClick, selectedNodeId, categoryFilter }: SkillTreeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Filter nodes by category if filter is set
  const filteredNodes = categoryFilter ? nodes.filter((n) => n.category === categoryFilter) : nodes;

  // Create a map of node IDs to their positions
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Group nodes by tier for layout
  const nodesByTier = new Map<number, SkillTreeNode[]>();
  filteredNodes.forEach((node) => {
    const tier = node.tier;
    if (!nodesByTier.has(tier)) {
      nodesByTier.set(tier, []);
    }
    nodesByTier.get(tier)!.push(node);
  });

  // Calculate positions - simple grid layout by tier
  const tiers = Array.from(nodesByTier.keys()).sort((a, b) => a - b);
  let currentY = 0;

  tiers.forEach((tier) => {
    const tierNodes = nodesByTier.get(tier)!;
    tierNodes.sort((a, b) => a.positionX - b.positionX);

    tierNodes.forEach((node, index) => {
      const col = index % NODES_PER_ROW;
      const row = Math.floor(index / NODES_PER_ROW);
      const x = col * (NODE_WIDTH + HORIZONTAL_GAP);
      const y = currentY + row * (NODE_HEIGHT + VERTICAL_GAP);
      nodePositions.set(node.id, { x, y });
    });

    const rowsInTier = Math.ceil(tierNodes.length / NODES_PER_ROW);
    currentY += rowsInTier * (NODE_HEIGHT + VERTICAL_GAP) + 40; // Extra gap between tiers
  });

  // Calculate canvas dimensions
  const allPositions = Array.from(nodePositions.values());
  const maxX = allPositions.length > 0 ? Math.max(...allPositions.map((p) => p.x)) + NODE_WIDTH + 40 : 400;
  const maxY = allPositions.length > 0 ? Math.max(...allPositions.map((p) => p.y)) + NODE_HEIGHT + 40 : 400;
  const canvasWidth = Math.max(maxX, NODES_PER_ROW * (NODE_WIDTH + HORIZONTAL_GAP));
  const canvasHeight = maxY;

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.5), 2));
  }, []);

  // Handle pan start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [position]
  );

  // Handle pan move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Center the view on mount
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        x: rect.width / 2,
        y: 50,
      });
    }
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-background-primary/50 rounded-lg border border-border-default" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button onClick={() => setScale((s) => Math.min(s + 0.2, 2))} className="w-8 h-8 rounded bg-background-secondary border border-border-default text-text-primary hover:border-accent-cyan transition-colors">
          +
        </button>
        <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))} className="w-8 h-8 rounded bg-background-secondary border border-border-default text-text-primary hover:border-accent-cyan transition-colors">
          −
        </button>
        <button
          onClick={() => {
            setScale(1);
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              setPosition({ x: rect.width / 2, y: 50 });
            }
          }}
          className="w-8 h-8 rounded bg-background-secondary border border-border-default text-text-primary hover:border-accent-cyan transition-colors text-xs"
        >
          ⟲
        </button>
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 right-4 z-10 text-xs text-text-muted bg-background-secondary/80 px-2 py-1 rounded">{Math.round(scale * 100)}%</div>

      {/* Graph container */}
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          width: canvasWidth,
          height: canvasHeight,
          position: "relative",
          padding: "20px",
        }}
      >
        {/* Nodes - clean grid layout without connecting lines */}
        {filteredNodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: NODE_WIDTH,
              }}
            >
              <SkillTreeNodeComponent node={node} onClick={onNodeClick} isSelected={selectedNodeId === node.id} />
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-text-muted">No challenges found for this category</p>
        </div>
      )}
    </div>
  );
}

export default SkillTreeGraph;
