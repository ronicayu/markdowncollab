import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: "#111110",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* M for Markdown */}
        <svg
          width="18"
          height="14"
          viewBox="0 0 18 14"
          fill="none"
          style={{ position: "absolute", left: 3, top: 9 }}
        >
          <path
            d="M1 13V1L6.5 8L12 1V13"
            stroke="#B8692A"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Cursor bar for Collab */}
        <div
          style={{
            position: "absolute",
            right: 6,
            top: 8,
            width: 3,
            height: 16,
            borderRadius: 1.5,
            background: "#B8692A",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
