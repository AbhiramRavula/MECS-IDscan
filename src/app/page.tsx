// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import BarcodeScanner, { type ScanResult } from "@/components/BarcodeScanner";
import RegistrationModal from "@/components/RegistrationModal";
import { db } from "@/app/lib/firebase";
import { doc, getDoc, addDoc, updateDoc, increment, collection, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { isLate, cn } from "@/app/lib/utils";
import { Clock, Users, History, CheckCircle2, AlertTriangle } from "lucide-react";
import Analytics from "@/components/Analytics";

export default function Home() {
  const [scannedRoll, setScannedRoll] = useState<string | null>(null);
  const [scannedName, setScannedName] = useState<string | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, late: 0 });

  // Fetch recent activity and stats
  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(5));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentLogs(logs);
      setStats({
        total: snapshot.size, // This is just for the last 5, you'd want a separate query for daily stats
        late: logs.filter((l: any) => l.isLate).length
      });
    });
  }, []);

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

        alert(`✅ Entry Logged: ${data.name} (${late ? "LATE" : "ON-TIME"})`);
        resetScanner();
      } else {
        // Unknown Roll Number -> Trigger Registration
        setShowRegister(true);
      }
    } catch (error) {
      console.error("Scan Error:", error);
      alert("Error processing scan.");
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
    <main className="min-h-screen bg-gray-50 flex flex-col pb-20 font-sans text-black">
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
                <p className="text-xs font-bold text-gray-500">{log.dept} • {log.year}</p>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
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
