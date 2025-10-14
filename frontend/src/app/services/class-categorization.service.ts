import { Injectable } from '@angular/core';

export type SchoolType = 'Nursery' | 'Primary (Local)' | 'Secondary (Local)' | 'Nursery & Primary (Local)' | 'International Primary' | 'International Secondary';

@Injectable({
  providedIn: 'root'
})
export class ClassCategorizationService {

  private classMap = {
    'Nursery': ['Baby', 'Middle', 'Top'],
    'Primary (Local)': ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'],
    'Secondary (Local)': ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'],
    'Nursery & Primary (Local)': ['Baby', 'Middle', 'Top', 'P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'],
    'International Primary': ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
    'International Secondary': ['Year 7 (or Form 1)', 'Year 8', 'Year 9', 'Year 10 (IGCSE)', 'Year 11', 'Year 12 (A-Level/IB 1)', 'Year 13 (A-Level/IB 2)']
  };

  getClassesForSchoolType(schoolType: SchoolType): string[] {
    return this.classMap[schoolType] || [];
  }
}
