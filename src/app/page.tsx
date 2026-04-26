// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import BarcodeScanner, { type ScanResult } from "@/components/BarcodeScanner";
import RegistrationModal from "@/components/RegistrationModal";
import { db } from "@/app/lib/firebase";
import { doc, getDoc, addDoc, updateDoc, increment, collection, serverTimestamp, query, orderBy, limit, onSnapshot, Timestamp, where } from "firebase/firestore";
import { isLate, cn } from "@/app/lib/utils";
import { Clock, Users, History, CheckCircle2, AlertTriangle, X } from "lucide-react";
import Analytics from "@/components/Analytics";

// Toast notification type
interface Toast {
  id: number;
  name: string;
  rollNo: string;
  isLate: boolean;
}

function formatTimestamp(ts: any): string {
  if (!ts) return "";
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export default function Home() {
  const [scannedRoll, setScannedRoll] = useState<string | null>(null);
  const [scannedName, setScannedName] = useState<string | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, late: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Fetch today's logs only
  useEffect(() => {
    const todayStart = Timestamp.fromDate(getStartOfToday());
    const q = query(
      collection(db, "logs"),
      where("timestamp", ">=", todayStart),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentLogs(logs);
      setStats({
        total: logs.length,
        late: logs.filter((l: any) => l.isLate).length
      });
    });
  }, []);

  // Auto-dismiss toasts after 2.5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 2500);
    return () => clearTimeout(timer);
  }, [toasts]);

  const showToast = (name: string, rollNo: string, late: boolean) => {
    setToasts((prev) => [...prev, { id: Date.now(), name, rollNo, isLate: late }]);
  };

  const handleScan = async (result: ScanResult) => {
    const roll = result.rollNo;
    setIsPaused(true);
    setScannedRoll(roll);
    setScannedName(result.name);

    try {
      const studentDoc = await getDoc(doc(db, "students", roll));

      if (studentDoc.exists()) {
        const data = studentDoc.data();
        const late = isLate();

        // 1. Log the entry
        await addDoc(collection(db, "logs"), {
          studentId: roll,
          name: data.name,
          dept: data.dept,
          year: data.year,
          isLate: late,
          timestamp: serverTimestamp(),
        });

        // 2. Update student stats if late
        if (late) {
          await updateDoc(doc(db, "students", roll), {
            totalLateCount: increment(1)
          });
        }

        // Show non-blocking toast and immediately reset for next scan
        showToast(data.name, roll, late);
        if (navigator.vibrate) navigator.vibrate(late ? [200, 100, 200] : [100]);
        resetScanner();
      } else {
        // Unknown Roll Number -> Trigger Registration
        setShowRegister(true);
      }
    } catch (error) {
      console.error("Scan Error:", error);
      showToast("ERROR", roll, true);
      resetScanner();
    }
  };

  const resetScanner = () => {
    setScannedRoll(null);
    setScannedName(undefined);
    setIsPaused(false);
    setShowRegister(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pb-20 font-sans text-black relative">
      {/* Toast Notifications — auto-dismiss, non-blocking */}
      <div className="fixed top-4 left-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "p-4 rounded-2xl shadow-xl border-2 flex items-center justify-between pointer-events-auto animate-in slide-in-from-top duration-300",
              toast.isLate
                ? "bg-red-50 border-red-500 text-red-900"
                : "bg-green-50 border-green-500 text-green-900"
            )}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} />
              <div>
                <p className="font-black text-sm">{toast.name}</p>
                <p className="text-[10px] font-bold opacity-70">{toast.rollNo}</p>
              </div>
            </div>
            <span className="text-xs font-black uppercase px-2 py-1 rounded-full bg-white">
              {toast.isLate ? "LATE" : "ON-TIME"}
            </span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-blue-900 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-black tracking-tighter">MECS SCANNER</h1>
        <p className="text-blue-200 text-sm font-bold">Attendance & Punctuality Tracker</p>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4 p-4 -mt-6">
        <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-black flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-900"><Users /></div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Total Today</p>
            <p className="text-xl font-black">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-black flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-lg text-red-600"><Clock /></div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Late Today</p>
            <p className="text-xl font-black">{stats.late}</p>
          </div>
        </div>
      </div>

      {/* Scanner Section */}
      <section className="p-4 flex-1">
        <BarcodeScanner onScan={handleScan} isPaused={isPaused} />
      </section>

      {/* Recent Activity */}
      <section className="p-4">
        <h3 className="text-lg font-black mb-3 flex items-center gap-2">
          <History size={20} /> RECENT SCANS
        </h3>
        <div className="space-y-3">
          {recentLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <p className="font-black text-blue-900">{log.name || log.studentId}</p>
                <p className="text-[11px] font-bold font-mono text-gray-500">{log.studentId}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-gray-400">{log.dept} • {log.year}</p>
                  <span className="text-[10px] font-bold text-gray-400">•</span>
                  <p className="text-[10px] font-black text-blue-600">
                    {formatTimestamp(log.timestamp)}
                  </p>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0",
                log.isLate ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              )}>
                {log.isLate ? "LATE" : "ON-TIME"}
              </div>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <p className="text-center text-gray-400 py-8 font-bold">No scans yet today</p>
          )}
        </div>
      </section>

      {/* Analytics Section */}
      <section className="border-t-4 border-black bg-white mt-4">
        <div className="p-4 bg-gray-100 border-b-2 border-gray-200">
          <h3 className="text-lg font-black flex items-center gap-2">
            <AlertTriangle size={20} className="text-blue-900" /> SYSTEM ANALYTICS
          </h3>
        </div>
        <Analytics />
      </section>

      {/* Registration Modal */}
      {showRegister && scannedRoll && (
        <RegistrationModal 
          rollNo={scannedRoll}
          initialName={scannedName}
          onClose={resetScanner} 
          onSuccess={resetScanner} 
        />
      )}
    </main>
  );
}
