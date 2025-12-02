"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VisualizationData, VisualizationStep, OPERATION_COLORS } from "@/types/visualization";
import ArrayVisualization from "./ArrayVisualization";
import TreeVisualization from "./TreeVisualization";
import GraphVisualization from "./GraphVisualization";
import VisualizationControls from "./VisualizationControls";

interface AlgorithmVisualizerProps {
  data: VisualizationData | null;
  isPlaying: boolean;
  speed: number;
  onStepChange?: (step: number) => void;
  onPlayPauseToggle?: () => void;
  onSpeedChange?: (speed: number) => void;
}

// WebGL detection utility
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return gl !== null;
  } catch (e) {
    return false;
  }
}

export default function AlgorithmVisualizer({ data, isPlaying, speed, onStepChange, onPlayPauseToggle, onSpeedChange }: AlgorithmVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  const [is3DMode, setIs3DMode] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [visualState, setVisualState] = useState<any>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check WebGL support on mount
  useEffect(() => {
    setWebGLSupported(detectWebGL());
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !webGLSupported || !is3DMode) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controlsRef.current = controls;

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [webGLSupported, is3DMode]);

  // Initialize visual state from data
  useEffect(() => {
    if (data) {
      setVisualState(JSON.parse(JSON.stringify(data.initialState)));
      setCurrentStep(0);
    }
  }, [data]);

  // Handle step playback
  useEffect(() => {
    if (!data || !isPlaying) {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
      return;
    }

    const playNextStep = () => {
      if (currentStep < data.steps.length) {
        applyStep(data.steps[currentStep]);
        setCurrentStep((prev) => prev + 1);
        onStepChange?.(currentStep + 1);

        // Schedule next step based on speed
        const delay = 1000 / speed;
        stepTimerRef.current = setTimeout(playNextStep, delay);
      } else {
        // Playback complete
        onPlayPauseToggle?.();
      }
    };

    stepTimerRef.current = setTimeout(playNextStep, 1000 / speed);

    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
    };
  }, [data, isPlaying, currentStep, speed, onStepChange, onPlayPauseToggle]);

  // Apply a visualization step to the current state
  const applyStep = useCallback(
    (step: VisualizationStep) => {
      if (!visualState) return;

      setVisualState((prevState: any) => {
        const newState = JSON.parse(JSON.stringify(prevState));

        switch (step.operation) {
          case "swap":
            if (Array.isArray(newState) && step.indices.length >= 2) {
              const [i, j] = step.indices;
              [newState[i], newState[j]] = [newState[j], newState[i]];
            }
            break;
          case "insert":
            if (Array.isArray(newState) && step.values && step.indices.length >= 1) {
              newState.splice(step.indices[0], 0, step.values[0]);
            }
            break;
          case "delete":
            if (Array.isArray(newState) && step.indices.length >= 1) {
              newState.splice(step.indices[0], 1);
            }
            break;
          // compare, visit, highlight don't modify state, just visual
        }

        return newState;
      });
    },
    [visualState]
  );

  // Step forward/backward handlers
  const handleStepForward = useCallback(() => {
    if (!data || currentStep >= data.steps.length) return;
    applyStep(data.steps[currentStep]);
    setCurrentStep((prev) => prev + 1);
    onStepChange?.(currentStep + 1);
  }, [data, currentStep, applyStep, onStepChange]);

  const handleStepBackward = useCallback(() => {
    if (!data || currentStep <= 0) return;
    // Reset to initial state and replay up to currentStep - 1
    setVisualState(JSON.parse(JSON.stringify(data.initialState)));
    const newStep = currentStep - 1;
    for (let i = 0; i < newStep; i++) {
      applyStep(data.steps[i]);
    }
    setCurrentStep(newStep);
    onStepChange?.(newStep);
  }, [data, currentStep, applyStep, onStepChange]);

  const handleToggle3D = useCallback(() => {
    setIs3DMode((prev) => !prev);
  }, []);

  // Loading state
  if (webGLSupported === null) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background-secondary">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-cyan/20 border-t-accent-cyan"></div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background-secondary">
        <p className="text-text-muted">No visualization data available</p>
      </div>
    );
  }

  const currentStepData = currentStep > 0 && currentStep <= data.steps.length ? data.steps[currentStep - 1] : null;

  return (
    <div className="w-full h-full flex flex-col bg-background-secondary">
      {/* Visualization Area */}
      <div className="flex-1 relative" ref={containerRef}>
        {/* 3D Mode with WebGL */}
        {is3DMode && webGLSupported && (
          <>
            {data.type === "array" && <ArrayVisualization scene={sceneRef.current} data={visualState} currentStep={currentStepData} is3D={true} />}
            {data.type === "tree" && <TreeVisualization scene={sceneRef.current} data={visualState} currentStep={currentStepData} is3D={true} />}
            {data.type === "graph" && <GraphVisualization scene={sceneRef.current} data={visualState} currentStep={currentStepData} is3D={true} />}
          </>
        )}

        {/* 2D Fallback Mode */}
        {(!is3DMode || !webGLSupported) && (
          <div className="absolute inset-0 p-4">
            {data.type === "array" && <ArrayVisualization scene={null} data={visualState} currentStep={currentStepData} is3D={false} />}
            {data.type === "tree" && <TreeVisualization scene={null} data={visualState} currentStep={currentStepData} is3D={false} />}
            {data.type === "graph" && <GraphVisualization scene={null} data={visualState} currentStep={currentStepData} is3D={false} />}
          </div>
        )}

        {/* WebGL not supported warning */}
        {!webGLSupported && <div className="absolute top-2 left-2 px-3 py-1 bg-accent-yellow/20 border border-accent-yellow/50 rounded text-xs text-accent-yellow">WebGL not supported - using 2D fallback</div>}
      </div>

      {/* Controls */}
      <VisualizationControls isPlaying={isPlaying} speed={speed} currentStep={currentStep} totalSteps={data.steps.length} is3DMode={is3DMode} webGLSupported={webGLSupported} onPlayPause={onPlayPauseToggle || (() => {})} onSpeedChange={onSpeedChange || (() => {})} onStepForward={handleStepForward} onStepBackward={handleStepBackward} onToggle3D={handleToggle3D} />
    </div>
  );
}
