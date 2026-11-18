import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "FlowParse — convert bank statement PDFs to reconciled Excel and CSV";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b5c4d",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background: "#eaf6f1",
              color: "#0b5c4d",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            FlowParse
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.04em",
              maxWidth: 940,
            }}
          >
            Bank statements in. Excel and CSV out.
          </div>
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.78)",
              fontSize: 28,
              lineHeight: 1.35,
              maxWidth: 880,
            }}
          >
            Reconcile balances, review flagged rows, and export a clean ledger.
            Digital and scanned PDFs.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.2)",
            paddingTop: 24,
            color: "rgba(255,255,255,0.7)",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex" }}>flowparse.vercel.app</div>
          <div style={{ display: "flex" }}>Private by default</div>
        </div>
      </div>
    ),
    size
  );
}
