// src/components/Analytics.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, onSnapshot, Timestamp, where, orderBy } from "firebase/firestore";
import { BarChart3, Download, Filter, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

interface LogEntry {
  studentId: string;
  name: string;
  dept: string;
  year: string;
  isLate: boolean;
  timestamp: any;
}

function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function formatTime(ts: any): string {
  if (!ts) return "";
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateForFilename(): string {
  const now = new Date();
  return `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
}

export default function Analytics() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [branchStats, setBranchStats] = useState<Record<string, number>>({});
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  useEffect(() => {
    const todayStart = Timestamp.fromDate(getStartOfToday());
    const q = query(
      collection(db, "logs"),
      where("timestamp", ">=", todayStart),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map((doc) => doc.data() as LogEntry);
      setLogs(allLogs);

      const stats: Record<string, number> = {};
      allLogs.forEach((log) => {
        if (log.isLate) {
          stats[log.dept] = (stats[log.dept] || 0) + 1;
        }
      });
      setBranchStats(stats);
      setAvailableBranches(Object.keys(stats).sort());
    });
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (yearFilter !== "ALL" && log.year !== yearFilter) return false;
    if (branchFilter !== "ALL" && log.dept !== branchFilter) return false;
    return true;
  });

  const filterLabel = [
    branchFilter !== "ALL" ? branchFilter : "All Branches",
    yearFilter !== "ALL" ? yearFilter : "All Years",
  ].join(" — ");

  const fileSuffix = [
    branchFilter !== "ALL" ? `_${branchFilter}` : "",
    yearFilter !== "ALL" ? `_${yearFilter}` : "",
  ].join("");

  const downloadCSV = () => {
    const lateLogs = filteredLogs;

    if (lateLogs.length === 0) {
      alert("No late comers to download.");
      return;
    }

    // Group by Department, then by Year
    const grouped: Record<string, Record<string, LogEntry[]>> = {};
    lateLogs.forEach((log) => {
      const dept = log.dept || "UNKNOWN";
      const year = log.year || "UNKNOWN";
      if (!grouped[dept]) grouped[dept] = {};
      if (!grouped[dept][year]) grouped[dept][year] = [];
      grouped[dept][year].push(log);
    });

    // Build CSV
    let csv = "Department,Year,Student Name,Roll Number,Time\n";

    const sortedDepts = Object.keys(grouped).sort();
    for (const dept of sortedDepts) {
      const years = Object.keys(grouped[dept]).sort();
      for (const year of years) {
        const students = grouped[dept][year];
        students.forEach((s) => {
          const time = formatTime(s.timestamp);
          csv += `${dept},${year},"${s.name || "N/A"}",${s.studentId},${time}\n`;
        });
      }
    }

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MECS_Late_Report_${formatDateForFilename()}${fileSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    if (filteredLogs.length === 0) {
      alert("No late comers to download.");
      return;
    }

    // Group by Department
    const grouped: Record<string, LogEntry[]> = {};
    filteredLogs.forEach((log) => {
      const dept = log.dept || "UNKNOWN";
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(log);
    });

    const wb = XLSX.utils.book_new();

    // Create one sheet per department
    const sortedDepts = Object.keys(grouped).sort();
    for (const dept of sortedDepts) {
      const students = grouped[dept]
        .sort((a, b) => (a.year || "").localeCompare(b.year || ""))
        .map((s, i) => ({
          "S.No": i + 1,
          "Student Name": s.name || "N/A",
          "Roll Number": s.studentId,
          "Year": s.year,
          "Time": formatTime(s.timestamp),
        }));

      const ws = XLSX.utils.json_to_sheet(students);
      ws["!cols"] = [
        { wch: 5 },  // S.No
        { wch: 25 }, // Name
        { wch: 18 }, // Roll
        { wch: 10 }, // Year
        { wch: 12 }, // Time
      ];
      XLSX.utils.book_append_sheet(wb, ws, dept);
    }

    const filename = `MECS_Late_Report_${formatDateForFilename()}${fileSuffix}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Branch-wise Late Stats */}
      <div className="bg-white p-6 rounded-3xl border-4 border-black shadow-xl">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2 uppercase">
          <BarChart3 size={24} className="text-blue-900" /> Late Comers by Branch
        </h3>

        <div className="space-y-4">
          {Object.entries(branchStats).length > 0 ? (
            Object.entries(branchStats)
              .sort(([, a], [, b]) => b - a)
              .map(([branch, count]) => (
                <div key={branch} className="space-y-1">
                  <div className="flex justify-between font-black text-xs uppercase">
                    <span>{branch}</span>
                    <span>{count} Late</span>
                  </div>
                  <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden border border-black">
                    <div
                      className="bg-blue-900 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min((count / Math.max(logs.length, 1)) * 100 * 5, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))
          ) : (
            <p className="text-center text-gray-400 py-4 font-bold italic">
              No late logs recorded yet.
            </p>
          )}
        </div>
      </div>

      {/* Download Section */}
      <div className="bg-white p-6 rounded-3xl border-4 border-black shadow-xl space-y-4">
        <h3 className="text-lg font-black flex items-center gap-2 uppercase">
          <Download size={20} className="text-blue-900" /> Download Late Report
        </h3>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full p-3 bg-gray-100 border-2 border-gray-200 rounded-xl font-bold text-black text-sm"
            >
              <option value="ALL">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full p-3 bg-gray-100 border-2 border-gray-200 rounded-xl font-bold text-black text-sm"
            >
              <option value="ALL">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-200">
          <p className="text-sm font-bold text-blue-900">
            {filteredLogs.length} late — {filterLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={downloadCSV}
            disabled={filteredLogs.length === 0}
            className="bg-gray-800 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            CSV
          </button>
          <button
            onClick={downloadExcel}
            disabled={filteredLogs.length === 0}
            className="bg-green-700 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={18} />
            EXCEL (.xlsx)
          </button>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="bg-blue-50 p-6 rounded-3xl border-4 border-blue-900 border-dashed">
        <p className="text-xs font-black text-blue-900 uppercase mb-1">Quick Insights</p>
        <p className="text-sm font-bold text-blue-800">
          Total Logs: <span className="text-lg font-black">{logs.length}</span> •
          Late: <span className="text-lg font-black text-red-600">{filteredLogs.length}</span>
        </p>
      </div>
    </div>
  );
}
