// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEPT_MAP: Record<string, string> = {
  "737": "IT",
  "740": "CME",
  "733": "CSE",
  "735": "ECE",
  "734": "EEE",
  "732": "CIVIL",
  "736": "MECH",
};

export function parseRollNumber(roll: string) {
  // Pattern: 1608-YY-BBB-NNN
  // Using a flexible regex that allows dashes or no dashes
  const regex = /1608-?(\d{2})-?(\d{3})-?(\d{3})/;
  const match = roll.match(regex);

  if (!match) return null;

  const [_, yearShort, deptCode, rollNo] = match;
  
  // Year Calculation: current year - start year
  // e.g., 2026 - 2022 = 4
  const currentYear = new Date().getFullYear();
  const currentYearShort = currentYear % 100;
  const startYear = parseInt(yearShort);
  const calculatedYear = currentYearShort - startYear;

  return {
    year: `${calculatedYear}${getYearSuffix(calculatedYear)} Year`,
    dept: DEPT_MAP[deptCode] || "UNKNOWN",
    rollNo: roll.replace(/-/g, ""), // Clean version
  };
}

function getYearSuffix(year: number) {
  if (year === 1) return "st";
  if (year === 2) return "nd";
  if (year === 3) return "rd";
  return "th";
}

export function isLate() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // Late if after 9:40 AM
  if (hours > 9) return true;
  if (hours === 9 && minutes > 40) return true;
  return false;
}
