"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { SkillTreeNode, SkillTreeEdge } from "@/lib/api";
import { SkillTreeNodeComponent } from "./SkillTreeNode";

interface SkillTreeGraphProps {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
  onNodeClick: (node: SkillTreeNode) => void;
  selectedNodeId?: string;
  categoryFilter?: string;
}

const NODE_WIDTH = 128;
const NODE_HEIGHT = 96;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 100;

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

  // Calculate positions for each node using positionX from database
  const tiers = Array.from(nodesByTier.keys()).sort((a, b) => a - b);
  tiers.forEach((tier, tierIndex) => {
    const tierNodes = nodesByTier.get(tier)!;

    // Sort nodes by positionX within each tier
    tierNodes.sort((a, b) => a.positionX - b.positionX);

    tierNodes.forEach((node) => {
      // Use positionX from database for horizontal positioning
      const x = node.positionX * (NODE_WIDTH + HORIZONTAL_GAP);
      const y = tierIndex * (NODE_HEIGHT + VERTICAL_GAP);
      nodePositions.set(node.id, { x, y });
    });
  });

  // Calculate canvas dimensions
  const allPositions = Array.from(nodePositions.values());
  const minX = Math.min(...allPositions.map((p) => p.x)) - NODE_WIDTH;
  const maxX = Math.max(...allPositions.map((p) => p.x)) + NODE_WIDTH * 2;
  const minY = Math.min(...allPositions.map((p) => p.y)) - NODE_HEIGHT;
  const maxY = Math.max(...allPositions.map((p) => p.y)) + NODE_HEIGHT * 2;
  const canvasWidth = maxX - minX;
  const canvasHeight = maxY - minY;

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

  // Filter edges to only show those connecting visible nodes
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => visibleNodeIds.has(e.fromNodeId) && visibleNodeIds.has(e.toNodeId));

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
        }}
      >
        {/* SVG for edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            left: minX,
            top: minY,
          }}
        >
          {filteredEdges.map((edge) => {
            const fromPos = nodePositions.get(edge.fromNodeId);
            const toPos = nodePositions.get(edge.toNodeId);
            if (!fromPos || !toPos) return null;

            const fromNode = filteredNodes.find((n) => n.id === edge.fromNodeId);
            const toNode = filteredNodes.find((n) => n.id === edge.toNodeId);

            // Determine edge color based on completion status
            let strokeColor = "rgba(100, 100, 120, 0.5)";
            if (fromNode?.isCompleted && toNode?.isUnlocked) {
              strokeColor = "rgba(0, 255, 255, 0.6)";
            } else if (fromNode?.isCompleted) {
              strokeColor = "rgba(0, 255, 0, 0.4)";
            }

            const x1 = fromPos.x - minX + NODE_WIDTH / 2;
            const y1 = fromPos.y - minY + NODE_HEIGHT;
            const x2 = toPos.x - minX + NODE_WIDTH / 2;
            const y2 = toPos.y - minY;

            // Create curved path
            const midY = (y1 + y2) / 2;

            return (
              <g key={edge.id}>
                <path d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`} fill="none" stroke={strokeColor} strokeWidth={2} strokeDasharray={fromNode?.isCompleted ? "none" : "5,5"} />
                {/* Arrow head */}
                <polygon points={`${x2},${y2} ${x2 - 5},${y2 - 8} ${x2 + 5},${y2 - 8}`} fill={strokeColor} />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {filteredNodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: pos.x - minX,
                top: pos.y - minY,
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
