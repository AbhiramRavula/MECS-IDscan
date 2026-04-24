// src/components/BarcodeScanner.tsx — Uses OCR to extract Name + Roll Number
"use client";

import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { Camera, Scan, AlertCircle, Zap, Type, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

export interface ScanResult {
  rollNo: string;
  name?: string;
}

interface BarcodeScannerProps {
  onScan: (result: ScanResult) => void;
  isPaused: boolean;
}

export default function BarcodeScanner({ onScan, isPaused }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState("CENTER ID CARD & TAP BUTTON");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Camera access denied. Please allow camera permissions and refresh.");
    }
  };

  const extractNameFromText = (text: string, rollLineIndex: number, lines: string[]): string | undefined => {
    // Strategy 1: Look for a "Name:" label anywhere in the text
    const nameLabel = text.match(/(?:name|student\s*name)\s*[:\-]?\s*([A-Za-z\s.]{3,})/i);
    if (nameLabel) {
      return cleanName(nameLabel[1]);
    }

    // Strategy 2: Look at lines near the roll number for a name-like string
    for (let i = rollLineIndex - 1; i >= Math.max(0, rollLineIndex - 4); i--) {
      const name = tryExtractName(lines[i]);
      if (name) return name;
    }
    // Also check lines AFTER the roll number (some cards have name below)
    for (let i = rollLineIndex + 1; i <= Math.min(lines.length - 1, rollLineIndex + 3); i++) {
      const name = tryExtractName(lines[i]);
      if (name) return name;
    }

    return undefined;
  };

  const tryExtractName = (line: string): string | undefined => {
    if (!line) return undefined;
    const cleaned = line.trim();
    // Remove common OCR junk but keep letters, spaces, dots
    const stripped = cleaned.replace(/[^A-Za-z\s.]/g, "").trim();
    // A name should be at least 3 chars long and have mostly letters
    if (stripped.length >= 3 && stripped.length / cleaned.length > 0.6) {
      return cleanName(stripped);
    }
    return undefined;
  };

  const cleanName = (raw: string): string => {
    return raw
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    setIsScanning(true);
    setStatusText("READING ID CARD...");

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Only capture the BOTTOM 45% of the frame — that's where the name + roll number are
    const cropTop = Math.floor(video.videoHeight * 0.55);
    const cropHeight = video.videoHeight - cropTop;

    canvas.width = video.videoWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw only the bottom portion of the video
    ctx.drawImage(
      video,
      0, cropTop, video.videoWidth, cropHeight,  // source: bottom 45%
      0, 0, canvas.width, canvas.height            // destination: full canvas
    );

    // Boost contrast for better OCR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      // Convert to grayscale
      const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      // High contrast threshold
      const val = gray > 140 ? 255 : 0;
      pixels[i] = val;
      pixels[i + 1] = val;
      pixels[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);

    if (navigator.vibrate) navigator.vibrate(100);

    try {
      const { data } = await Tesseract.recognize(canvas, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setStatusText(`READING... ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });

      const text = data.text;
      console.log("=== OCR FULL TEXT ===");
      console.log(text);
      console.log("=== LINES DETECTED ===");

      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      lines.forEach((line, i) => console.log(`  Line ${i}: "${line}"`));

      // Find the roll number
      const rollRegex = /1608[-\s]?(\d{2})[-\s]?(\d{3})[-\s]?(\d{3})/;
      let rollNo: string | null = null;
      let name: string | undefined = undefined;
      let rollLineIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(rollRegex);
        if (match) {
          rollNo = `1608${match[1]}${match[2]}${match[3]}`;
          rollLineIdx = i;
          break;
        }
      }

      if (rollNo) {
        // Try to extract the name from the line above the roll number
        name = extractNameFromText(text, rollLineIdx, lines);

        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setStatusText(
          name
            ? `✅ ${name} — ${rollNo}`
            : `✅ FOUND: ${rollNo}`
        );

        setTimeout(() => {
          onScan({ rollNo: rollNo!, name });
          setStatusText("CENTER ID CARD & TAP BUTTON");
        }, 1000);
      } else {
        if (navigator.vibrate) navigator.vibrate(200);
        setStatusText("❌ NO ROLL NUMBER FOUND — TRY AGAIN");
        alert(
          `Could not find a roll number (1608-XX-XXX-XXX).\n\nText found:\n"${text.substring(0, 300)}"\n\nTry holding the card closer and in good light.`
        );
        setTimeout(() => setStatusText("CENTER ID CARD & TAP BUTTON"), 2000);
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setStatusText("❌ OCR FAILED — TRY AGAIN");
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-4 border-black relative">
        <div className="bg-blue-900 text-white p-5 flex justify-between items-center">
          <h2 className="font-black text-lg flex items-center gap-3 italic tracking-tighter">
            <Scan size={24} className="text-yellow-400" />
            ID CARD READER
          </h2>
          <div className="text-[10px] font-black bg-blue-800 px-2 py-1 rounded border border-blue-700">
            OCR v2.0
          </div>
        </div>

        <div className="relative bg-black aspect-[4/3] overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {!error && !isPaused && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-end">
              {/* Dark overlay on top portion (photo area - we don't read this) */}
              <div className="flex-1 bg-black/40"></div>
              {/* Highlighted bottom zone — this is what OCR reads */}
              <div className="h-[45%] border-4 border-yellow-400 bg-transparent relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500 animate-pulse"></div>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <p className="text-white font-black text-[10px] uppercase tracking-widest bg-black/70 px-3 py-1 rounded-full">
                    ↑ Name & Roll Number here ↑
                  </p>
                </div>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="absolute inset-0 bg-blue-900/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <Loader2 size={48} className="text-yellow-400 animate-spin" />
              <p className="text-white font-black text-sm mt-4 uppercase tracking-widest">
                Reading Text...
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-red-900/90 backdrop-blur-md">
              <AlertCircle size={48} className="mb-4" />
              <p className="font-bold">{error}</p>
              <button
                onClick={startCamera}
                className="mt-4 px-6 py-3 bg-white text-red-900 rounded-full font-black uppercase"
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="p-6 bg-gray-50 flex flex-col items-center gap-4 border-t-4 border-black">
          <button
            onClick={captureAndScan}
            disabled={isPaused || isScanning || !!error}
            className={cn(
              "w-28 h-28 rounded-full border-8 border-blue-900 flex items-center justify-center transition-all active:scale-75 shadow-2xl",
              isScanning ? "bg-gray-200" : "bg-white"
            )}
          >
            <div
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center text-white transition-all",
                isScanning ? "bg-gray-400" : "bg-blue-900"
              )}
            >
              {isScanning ? (
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Zap size={40} fill="white" />
              )}
            </div>
          </button>

          <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest text-center px-4">
            {statusText}
          </p>
        </div>
      </div>

      <div className="px-4">
        <button
          onClick={() => {
            const val = prompt("Enter Roll Number Manually (e.g. 160822737055):");
            if (val) onScan({ rollNo: val });
          }}
          className="w-full py-3 border-2 border-black rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 bg-white"
        >
          <Type size={14} /> MANUAL ENTRY BACKUP
        </button>
      </div>
    </div>
  );
}
