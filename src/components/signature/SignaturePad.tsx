"use client";

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";

export interface SignaturePadRef {
  toDataURL: () => string;
  isEmpty: () => boolean;
  clear: () => void;
}

interface Props {
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  className?: string;
}

const SignaturePad = forwardRef<SignaturePadRef, Props>(
  ({ height = 200, penColor = "#000", backgroundColor = "#fff", className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasDrawn, setHasDrawn] = useState(false);
    const drawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const activePointerId = useRef<number | null>(null);

    const fillBackground = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }, [backgroundColor]);

    // Keep the canvas backing store sized to the rendered box × DPR so strokes are crisp.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cssW = Math.max(1, Math.floor(rect.width));
        const cssH = Math.max(1, Math.floor(rect.height));
        const targetW = cssW * dpr;
        const targetH = cssH * dpr;
        if (canvas.width === targetW && canvas.height === targetH) return;

        // Preserve existing strokes when the box resizes (e.g. orientation change).
        const prev = document.createElement("canvas");
        prev.width = canvas.width;
        prev.height = canvas.height;
        const prevCtx = prev.getContext("2d");
        const hadContent = canvas.width > 0 && canvas.height > 0;
        if (hadContent && prevCtx) prevCtx.drawImage(canvas, 0, 0);

        canvas.width = targetW;
        canvas.height = targetH;
        fillBackground();
        const ctx = canvas.getContext("2d");
        if (ctx && hadContent) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, targetW, targetH);
          ctx.restore();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      };

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      window.addEventListener("orientationchange", resize);
      return () => {
        ro.disconnect();
        window.removeEventListener("orientationchange", resize);
      };
    }, [fillBackground]);

    function getPoint(e: React.PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
      // Ignore secondary touches once a stroke is in progress (prevents iOS palm jumping).
      if (activePointerId.current !== null) return;
      e.preventDefault();
      activePointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      setHasDrawn(true);
      lastPoint.current = getPoint(e);
    }

    function draw(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || activePointerId.current !== e.pointerId) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !lastPoint.current) return;

      const point = getPoint(e);
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 1.6 + pressure * 1.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      lastPoint.current = point;
    }

    function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
      if (activePointerId.current !== e.pointerId) return;
      drawing.current = false;
      lastPoint.current = null;
      activePointerId.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }

    const clear = useCallback(() => {
      fillBackground();
      setHasDrawn(false);
    }, [fillBackground]);

    useImperativeHandle(ref, () => ({
      toDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
      isEmpty: () => !hasDrawn,
      clear,
    }));

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          width: "100%",
          height: `${height}px`,
          touchAction: "none",
          cursor: "crosshair",
          display: "block",
        }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
      />
    );
  }
);

SignaturePad.displayName = "SignaturePad";
export default SignaturePad;
