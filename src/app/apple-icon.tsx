import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: "#111110",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* M for Markdown */}
        <svg
          width="100"
          height="80"
          viewBox="0 0 18 14"
          fill="none"
          style={{ position: "absolute", left: 14, top: 50 }}
        >
          <path
            d="M1 13V1L6.5 8L12 1V13"
            stroke="#B8692A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Cursor bar */}
        <div
          style={{
            position: "absolute",
            right: 34,
            top: 46,
            width: 14,
            height: 88,
            borderRadius: 7,
            background: "#B8692A",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
