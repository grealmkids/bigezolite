import { Injectable } from '@angular/core';

export type SchoolType = 'Nursery' | 'Primary (Local)' | 'Secondary (Local)' | 'Nursery & Primary (Local)' | 'International Primary' | 'International Secondary';

@Injectable({
  providedIn: 'root'
})
export class ClassCategorizationService {
  private classMap: Record<string, string[]> = {
    'nursery': ['Baby', 'Middle', 'Top'],
    'primary (local)': ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'],
    'secondary (local)': ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'],
    'nursery & primary (local)': ['Baby', 'Middle', 'Top', 'P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'],
    'international primary': ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
    'international secondary': ['Year 7 (or Form 1)', 'Year 8', 'Year 9', 'Year 10 (IGCSE)', 'Year 11', 'Year 12 (A-Level/IB 1)', 'Year 13 (A-Level/IB 2)']
  };

  /**
   * Returns a list of class names for a given school type.
   * This method is tolerant of minor variations in the stored school_type string
   * (for example: "Secondary School (Local)", "Secondary (Local)", etc.).
   */
  getClassesForSchoolType(schoolType?: string): string[] {
    if (!schoolType) { return []; }
    const key = schoolType.toLowerCase().trim();

    // direct match
    if (this.classMap[key]) {
      return this.classMap[key];
    }

    // tolerant matching: try to find a map key that is contained inside the provided value
    for (const k of Object.keys(this.classMap)) {
      if (key.includes(k) || k.includes(key)) {
        return this.classMap[k];
      }
    }

    // heuristic matching based on keywords
    if (key.includes('secondary')) { return this.classMap['secondary (local)'] || []; }
    if (key.includes('primary')) { return this.classMap['primary (local)'] || []; }
    if (key.includes('nursery')) { return this.classMap['nursery'] || []; }

    // no match
    console.warn('[ClassCategorization] No classes found for schoolType:', schoolType);
    return [];
  }
}
