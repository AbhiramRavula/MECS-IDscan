// src/components/Analytics.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import { BarChart3 } from "lucide-react";

export default function Analytics() {
  const [logs, setLogs] = useState<any[]>([]);
  const [branchStats, setBranchStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const q = query(collection(db, "logs"));
    return onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => doc.data());
      setLogs(allLogs);

      // Calculate Late Counts by Branch
      const stats: Record<string, number> = {};
      allLogs.forEach((log: any) => {
        if (log.isLate) {
          stats[log.dept] = (stats[log.dept] || 0) + 1;
        }
      });
      setBranchStats(stats);
    });
  }, []);

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white p-6 rounded-3xl border-4 border-black shadow-xl">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2 uppercase">
          <BarChart3 size={24} className="text-blue-900" /> Late Comers by Branch
        </h3>
        
        <div className="space-y-4">
          {Object.entries(branchStats).length > 0 ? (
            Object.entries(branchStats).map(([branch, count]) => (
              <div key={branch} className="space-y-1">
                <div className="flex justify-between font-black text-xs uppercase">
                  <span>{branch}</span>
                  <span>{count} Late</span>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden border border-black">
                  <div 
                    className="bg-blue-900 h-full transition-all duration-500" 
                    style={{ width: `${Math.min((count / logs.length) * 100 * 5, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-4 font-bold italic">No late logs recorded yet.</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-3xl border-4 border-blue-900 border-dashed">
        <p className="text-xs font-black text-blue-900 uppercase mb-1">Quick Insights</p>
        <p className="text-sm font-bold text-blue-800">
          Total Logs processed: <span className="text-lg font-black">{logs.length}</span>
        </p>
      </div>
    </div>
  );
}
