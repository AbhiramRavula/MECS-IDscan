// src/components/RegistrationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { parseRollNumber, isLate } from "@/app/lib/utils";
import { X, UserPlus, Save } from "lucide-react";

interface RegistrationModalProps {
  rollNo: string;
  initialName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RegistrationModal({ rollNo, initialName, onClose, onSuccess }: RegistrationModalProps) {
  const [name, setName] = useState(initialName || "");
  const parsed = parseRollNumber(rollNo);
  const [dept, setDept] = useState(parsed?.dept || "IT");
  const [year, setYear] = useState(parsed?.year || "1st Year");
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create Student Document
      const studentData = {
        name,
        dept,
        year,
        rollNo,
        totalLateCount: isLate() ? 1 : 0,
        registeredAt: serverTimestamp(),
      };
      await setDoc(doc(db, "students", rollNo), studentData);

      // 2. Log the Entry
      await addDoc(collection(db, "logs"), {
        studentId: rollNo,
        name,
        dept,
        year,
        isLate: isLate(),
        timestamp: serverTimestamp(),
      });

      onSuccess();
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Failed to save student. Check Firebase permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-md border-4 border-blue-900 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-900 p-4 flex justify-between items-center text-white">
          <h2 className="text-xl font-black flex items-center gap-2 tracking-tight">
            <UserPlus size={24} /> NEW STUDENT
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
            <label className="text-[10px] font-bold text-blue-900 uppercase">Scanned Roll No</label>
            <p className="text-lg font-black font-mono text-blue-900">{rollNo}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-500">Full Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full p-4 bg-gray-100 border-2 border-gray-200 rounded-xl focus:border-blue-600 outline-none font-bold transition-all text-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Department</label>
              <select 
                value={dept} 
                onChange={(e) => setDept(e.target.value)}
                className="w-full p-4 bg-gray-100 border-2 border-gray-200 rounded-xl font-bold text-black"
              >
                {["IT", "CSE", "ECE", "EEE", "CIVIL", "MECH"].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-500">Year</label>
              <select 
                value={year} 
                onChange={(e) => setYear(e.target.value)}
                className="w-full p-4 bg-gray-100 border-2 border-gray-200 rounded-xl font-bold text-black"
              >
                {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 text-white p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? "SAVING..." : <><Save size={24} /> REGISTER & LOG ENTRY</>}
          </button>
        </form>
      </div>
    </div>
  );
}
