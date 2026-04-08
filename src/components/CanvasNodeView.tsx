"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRef, useState, useCallback, useEffect } from "react";

const COLORS = [
  { label: "Black", value: "#000000" },
  { label: "Red", value: "#DC2626" },
  { label: "Blue", value: "#2563EB" },
];

export default function CanvasNodeView({ node, updateAttributes }: NodeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [eraser, setEraser] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  const width = 600;
  const height = 300;

  // Load existing drawing from node attrs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataUrl = node.attrs.dataUrl as string;
    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    }
  }, [node.attrs.dataUrl]);

  const getPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height]
  );

  const saveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    updateAttributes({ dataUrl });
  }, [updateAttributes]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setDrawing(true);
      setLastPos(getPos(e));
    },
    [getPos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawing || !lastPos) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = eraser ? "#FFFFFF" : color;
      ctx.lineWidth = eraser ? 20 : 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setLastPos(pos);
    },
    [drawing, lastPos, color, eraser, getPos]
  );

  const handleMouseUp = useCallback(() => {
    if (drawing) {
      setDrawing(false);
      setLastPos(null);
      saveCanvas();
    }
  }, [drawing, saveCanvas]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    saveCanvas();
  }, [width, height, saveCanvas]);

  return (
    <NodeViewWrapper className="my-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white" contentEditable={false}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-500 mr-2">Draw</span>
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => { setColor(c.value); setEraser(false); }}
              className={`w-5 h-5 rounded-full border-2 transition-all ${
                color === c.value && !eraser ? "border-gray-800 scale-110" : "border-gray-300"
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
          <button
            onClick={() => setEraser(!eraser)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              eraser ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
            title="Eraser"
          >
            Eraser
          </button>
          <button
            onClick={handleClear}
            className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors ml-auto"
            title="Clear canvas"
          >
            Clear
          </button>
        </div>
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </NodeViewWrapper>
  );
}
