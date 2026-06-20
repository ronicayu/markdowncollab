"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, notFound } from "next/navigation";

interface DocNode {
  id: string;
  title: string;
  status: string;
  forkedFrom: string | null;
}

interface Edge {
  source: string;
  target: string;
  type: "link" | "fork";
}

interface GraphNode extends DocNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Status colors aligned to DESIGN.md semantic palette:
// draft -> warm gray 500, in_review -> Notion Orange, approved -> Notion Green.
const STATUS_COLORS: Record<string, string> = {
  draft: "#615d59",
  in_review: "#dd5b00",
  approved: "#1aae39",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.draft;
}

export default function GraphPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_GRAPH_VIEW !== "true") {
    notFound();
  }
  const router = useRouter();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const w = window.innerWidth - 40;
    const h = window.innerHeight - 120;
    setDimensions({ width: Math.max(600, w), height: Math.max(400, h) });
  }, []);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) return;
        const docs: DocNode[] = await res.json();

        // Fetch markdown content to find [[wiki-links]]
        const edgeSet: Edge[] = [];
        const docIds = new Set(docs.map((d) => d.id));
        const docsByTitle = new Map(docs.map((d) => [d.title.toLowerCase(), d.id]));

        for (const doc of docs) {
          // Fork edges
          if (doc.forkedFrom && docIds.has(doc.forkedFrom)) {
            edgeSet.push({ source: doc.forkedFrom, target: doc.id, type: "fork" });
          }
        }

        // Fetch markdown for each doc to scan for [[links]]
        await Promise.all(
          docs.map(async (doc) => {
            try {
              const mdRes = await fetch(`/api/documents/${doc.id}/export`);
              if (!mdRes.ok) return;
              const text = await mdRes.text();
              const linkMatches = text.matchAll(/\[\[([^\]]+)\]\]/g);
              for (const m of linkMatches) {
                const linkedTitle = m[1].toLowerCase();
                const targetId = docsByTitle.get(linkedTitle);
                if (targetId && targetId !== doc.id) {
                  edgeSet.push({ source: doc.id, target: targetId, type: "link" });
                }
              }
            } catch {}
          })
        );

        // Initialize nodes with random positions
        const { width, height } = dimensions;
        const graphNodes: GraphNode[] = docs.map((d, i) => ({
          ...d,
          x: width / 2 + (Math.random() - 0.5) * width * 0.6,
          y: height / 2 + (Math.random() - 0.5) * height * 0.6,
          vx: 0,
          vy: 0,
        }));

        setNodes(graphNodes);
        setEdges(edgeSet);
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, [dimensions]);

  // Force-directed layout simulation
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const simulate = useCallback(() => {
    const ns = [...nodesRef.current];
    const es = edgesRef.current;
    if (ns.length === 0) return;

    const { width, height } = dimensions;
    const REPULSION = 5000;
    const SPRING = 0.01;
    const REST_LEN = 120;
    const DAMPING = 0.85;
    const CENTER_PULL = 0.002;

    // Reset forces
    for (const n of ns) { n.vx = 0; n.vy = 0; }

    // Repulsion between all pairs
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        let dx = ns[j].x - ns[i].x;
        let dy = ns[j].y - ns[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        ns[i].vx -= dx;
        ns[i].vy -= dy;
        ns[j].vx += dx;
        ns[j].vy += dy;
      }
    }

    // Spring forces for edges
    const nodeMap = new Map(ns.map((n) => [n.id, n]));
    for (const e of es) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = SPRING * (dist - REST_LEN);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    // Center pull
    for (const n of ns) {
      n.vx += (width / 2 - n.x) * CENTER_PULL;
      n.vy += (height / 2 - n.y) * CENTER_PULL;
    }

    // Apply velocities with damping
    for (const n of ns) {
      n.x += n.vx * DAMPING;
      n.y += n.vy * DAMPING;
      // Keep in bounds
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    }

    setNodes([...ns]);
  }, [dimensions]);

  useEffect(() => {
    if (nodes.length === 0) return;
    let frame = 0;
    const MAX_FRAMES = 200;

    function tick() {
      if (frame >= MAX_FRAMES) return;
      simulate();
      frame++;
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
    // Run once when nodes first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length > 0, simulate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--page-bg)" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading graph...</p>
      </div>
    );
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--page-bg)" }}>
      {/* Top bar: white surface with whisper border (not dark chrome) */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--rule)" }}
      >
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-[15px] font-bold transition-colors"
            style={{ color: "var(--ink)" }}
          >
            MC
          </a>
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>/</span>
          <span
            className="text-[15px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Document Graph
          </span>
        </div>
        <a
          href="/"
          className="text-[15px] font-semibold hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Back to documents
        </a>
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-4 py-2 border-b text-xs"
        style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.draft }} />
          Draft
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.in_review }} />
          In Review
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.approved }} />
          Approved
        </span>
        <span className="flex items-center gap-1.5 ml-4">
          <span
            className="inline-block w-6 h-0.5"
            style={{ background: "var(--ink-muted)" }}
          />
          Wiki link
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-6 h-0.5"
            style={{ borderTop: "2px dashed #0075de" }}
          />
          Fork
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {nodes.length === 0 ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--ink-muted)" }}
          >
            No documents found. Create some documents first.
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="mx-auto"
          >
            {/* Edges */}
            {edges.map((e, i) => {
              const s = nodeMap.get(e.source);
              const t = nodeMap.get(e.target);
              if (!s || !t) return null;
              return (
                <line
                  key={`edge-${i}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={e.type === "fork" ? "#0075de" : "#a39e98"}
                  strokeWidth={e.type === "fork" ? 2 : 1.5}
                  strokeDasharray={e.type === "fork" ? "6,3" : undefined}
                  opacity={0.6}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onClick={() => router.push(`/doc/${n.id}`)}
                onMouseEnter={() => setHoveredNode(n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  r={hoveredNode === n.id ? 22 : 18}
                  fill={getStatusColor(n.status)}
                  opacity={hoveredNode === n.id ? 1 : 0.85}
                  stroke={hoveredNode === n.id ? "#ffffff" : "none"}
                  strokeWidth={2}
                />
                <text
                  y={32}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#615d59"
                  fontWeight={hoveredNode === n.id ? 600 : 400}
                >
                  {n.title.length > 20 ? n.title.slice(0, 18) + "..." : n.title}
                </text>
                <text
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fill="white"
                  fontWeight={600}
                >
                  {n.title.slice(0, 2).toUpperCase()}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
