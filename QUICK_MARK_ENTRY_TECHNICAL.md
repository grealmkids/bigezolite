# Quick Mark Entry - Technical Implementation Details

## Architecture Overview

The redesigned quick mark entry component now uses a **two-view architecture**:

```
┌─────────────────────────────────────────────┐
│ Component State                             │
├─────────────────────────────────────────────┤
│                                             │
│  showMarkForm = false                       │
│  ├─ View: Student Table (Filter & Select)  │
│  └─ Actions: Filter, Select Exam Set       │
│                                             │
│  showMarkForm = true                        │
│  ├─ View: Mark Entry Modal (Overlay)       │
│  └─ Actions: Subject, Element, Mark        │
│                                             │
└─────────────────────────────────────────────┘
```

## Component Properties

### User Selection State
```typescript
schoolId: number = 0;              // Current school context
selectedClass: string = '';         // P.1, P.2, etc.
selectedYear: number = 2025;       // Academic year
selectedExamSetId: number | null;  // Selected exam for marks entry
```

### Display Data
```typescript
classes: string[] = [];            // Available classes for school type
years: number[] = [];              // [2025, 2024, 2023, 2022, 2021]
examSets: ExamSet[] = [];          // Exam sets for filters
students: StudentReport[] = [];    // Students in selected class
subjects: Subject[] = [];          // Subjects in selected exam set
assessmentElements: AssessmentElement[] = []; // All elements for exam set
```

### Mark Entry Form State
```typescript
showMarkForm: boolean = false;                    // Modal visibility
selectedStudentForEntry: StudentReport | null;   // Student being edited
selectedSubjectId: number | null = null;        // Subject selection
selectedElementId: number | null = null;        // Element selection
markValue: number | null = null;                // Mark being entered
selectedElement: AssessmentElement | null;      // Full element data
```

### Loading & UI State
```typescript
loading: boolean = false;          // Exam sets loading
loadingStudents: boolean = false;  // Students loading
saving: boolean = false;           // Mark save in progress
```

## Method Call Flow

### Initialization Flow
```
ngOnInit()
  ↓
SchoolService.getMySchool()
  ↓
  ├─ schoolId set
  ├─ loadClasses() → ClassCategorizationService.getClassesForSchoolType()
  ├─ generateYearsList() → creates [2025, 2024, 2023, 2022, 2021]
  └─ loadExamSets() → MarksService.getExamSets(schoolId, filters)
```

### Class Selection Flow
```
User selects class in dropdown
  ↓
onClassChange() called
  ↓
  ├─ loadExamSets() → Gets exams for (schoolId, year, class)
  └─ loadStudents() → StudentService.getStudents(schoolId, undefined, class)
  
Students table populates
```

### Exam Set Selection Flow
```
User selects exam set in dropdown
  ↓
onExamSetChange(examSetId) called
  ↓
selectedExamSetId = examSetId
  
(No additional loading - exams already loaded)
(Elements only loaded when opening mark form)
```

### Mark Entry Modal Flow
```
User clicks "Enter Marks" on student row
  ↓
openMarkEntryForm(student) called
  ↓
  ├─ Validate exam set selected
  ├─ Set selectedStudentForEntry = student
  ├─ Set showMarkForm = true (modal appears)
  ├─ Reset form fields (subject, element, mark)
  └─ loadSubjectsAndElements()
       ├─ MarksService.getAssessmentElements(examSetId)
       ├─ Extract unique subjects from elements
       ├─ Sort subjects alphabetically
       └─ Populate subjects dropdown
  
Subject dropdown now ready for selection
```

### Subject Selection Flow
```
User selects subject in dropdown
  ↓
onSubjectChange(subjectId) called
  ↓
  ├─ selectedSubjectId = subjectId
  ├─ selectedElementId = null (reset)
  └─ markValue = null (reset)
  
Element dropdown updates (via getFilteredElements())
```

### Element Selection Flow
```
User selects element in dropdown
  ↓
onElementChange(elementId) called
  ↓
  ├─ selectedElementId = elementId
  ├─ selectedElement = full element object (for max_score)
  └─ markValue = null (reset)
  
Mark input now enabled with validation
```

### Mark Save Flow
```
User enters mark and clicks "Save Mark"
  ↓
saveMark() called
  ↓
validateForm() checks:
  ├─ selectedExamSetId exists
  ├─ selectedSubjectId exists
  ├─ selectedElementId exists
  ├─ markValue >= 0
  ├─ markValue <= max_score
  └─ All fields filled (no nulls)

If valid:
  ├─ saving = true (disable button)
  ├─ Build entry object:
  │  ├─ student_identifier: reg_number
  │  ├─ identifier_type: 'reg_number'
  │  ├─ element_id: selectedElementId
  │  └─ score_obtained: markValue
  └─ MarksService.bulkUploadMarks(examSetId, schoolId, [entry])
       ├─ Backend validates entry
       ├─ Saves to database
       └─ Returns success/error
  
On success:
  ├─ Show snackbar: "Mark saved successfully!"
  ├─ closeMarkForm() called
  │  ├─ showMarkForm = false (modal hidden)
  │  ├─ Clear all form state
  │  └─ Return to students table
  └─ User can select another student

On error:
  ├─ Show snackbar: "Failed to save mark"
  ├─ keeping = false (re-enable button)
  └─ Modal stays open (try again or cancel)
```

### Close Form Flow
```
User clicks "Cancel" button or close (✕)
  ↓
closeMarkForm() called
  ↓
  ├─ showMarkForm = false
  ├─ selectedStudentForEntry = null
  ├─ selectedSubjectId = null
  ├─ selectedElementId = null
  ├─ markValue = null
  └─ selectedElement = null
  
Returns to students table view
```

## Template Visibility Logic

### Filters Section (Always visible unless form open)
```html
<div class="filters-section" *ngIf="!showMarkForm">
```

### Students Section (Visible after class selection, unless form open)
```html
<div class="students-section" *ngIf="selectedClass && !showMarkForm">
```

### Students Table (Visible when loaded with students)
```html
<div *ngIf="!loadingStudents && students.length > 0" class="students-table">
```

### "Enter Marks" Button State
```html
<button (click)="openMarkEntryForm(student)" [disabled]="!selectedExamSetId">
```
- **Enabled**: Blue, clickable when exam set selected
- **Disabled**: Gray, shows "Select exam set first" tooltip

### Mark Form Modal (Only visible when entering marks)
```html
<div class="mark-form-overlay" *ngIf="showMarkForm">
```

## API Integration

### Exam Sets Loading
```typescript
marksService.getExamSets(schoolId, { 
  year: selectedYear,
  class_level: selectedClass 
})
```
- **Endpoint**: `GET /api/v1/marks/exams`
- **Params**: `?schoolId=1&year=2025&class_level=P.1`
- **Response**: Array of exam sets with: exam_set_id, set_name, term, year, class_level

### Students Loading
```typescript
studentService.getStudents(
  schoolId,
  undefined,      // searchTerm
  selectedClass   // classTerm
)
```
- **Endpoint**: `GET /api/v1/students`
- **Params**: `?schoolId=1&classTerm=P.1&statusTerm=Active`
- **Response**: Object with: { items: StudentReport[], total: number }

### Assessment Elements Loading
```typescript
marksService.getAssessmentElements(selectedExamSetId)
```
- **Endpoint**: `GET /api/v1/marks/exams/:examSetId/elements`
- **Response**: Array of elements with: element_id, element_name, subject_id, subject_name, max_score

### Save Mark
```typescript
marksService.bulkUploadMarks(
  selectedExamSetId,
  schoolId,
  [{ 
    student_identifier: regNumber,
    identifier_type: 'reg_number',
    element_id: elementId,
    score_obtained: markValue
  }]
)
```
- **Endpoint**: `POST /api/v1/marks/upload`
- **Body**: { examSetId, schoolId, marks: [...] }
- **Response**: { success: true, message: "..." }

## Validation Rules

### Form Validation (saveMark)
```typescript
validateForm(): boolean {
  return (
    selectedExamSetId !== null &&      // Must select exam
    selectedSubjectId !== null &&      // Must select subject
    selectedElementId !== null &&      // Must select element
    markValue !== null &&              // Must enter mark
    markValue !== undefined &&         // Not undefined
    markValue >= 0 &&                  // No negative marks
    markValue <= selectedElement.max_score  // Within max
  );
}
```

### Button States
- **"Enter Marks" Button**: Disabled if `!selectedExamSetId`
- **Subject Dropdown**: Always enabled (no dependencies)
- **Element Dropdown**: Disabled if `!selectedSubjectId`
- **Mark Input**: Disabled if `!selectedElementId`
- **Save Button**: Disabled if `!validateForm() || saving || loading`
- **Cancel Button**: Disabled if `saving`

## CSS Classes & Structure

### Layout Grid
```scss
.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
```
- Responsive: 3 columns on desktop, 2 on tablet, 1 on mobile

### Modal Positioning
```scss
.mark-form-overlay {
  position: fixed;           // Fixed viewport position
  top: 0; left: 0;          // Full screen backdrop
  display: flex;            // Center content
  align-items: center;      // Vertical center
  justify-content: center;  // Horizontal center
  z-index: 1000;           // Above all other content
}

.mark-form-modal {
  max-width: 500px;         // Reasonable form width
  max-height: 90vh;         // Don't exceed viewport
  overflow-y: auto;         // Scrollable if needed
}
```

### Color Scheme
```scss
$primary-blue: #007bff;
$success-green: #28a745;
$background-light: #f9f9f9;
$background-lighter: #fafafa;
$text-dark: #333;
$text-light: #666;
$border-color: #ddd;
```

## Error Handling

### Loading Errors
```typescript
error: (err) => {
  console.error('Error loading students:', err);
  students = [];
  loadingStudents = false;
  // No snackbar - silent fail with empty table
}
```

### Save Errors
```typescript
error: (err) => {
  console.error('Error saving mark:', err);
  snack.open('Failed to save mark', 'Close', { duration: 3000 });
  saving = false;
  // Modal stays open, user can retry or cancel
}
```

## Performance Considerations

### Data Caching
- **Exam Sets**: Reloaded when class or year changes
- **Students**: Loaded once per class selection
- **Elements**: Loaded only when opening mark form (lazy)
- **Subjects**: Extracted from elements on demand

### Lazy Loading
- Elements only fetched when user clicks "Enter Marks"
- Subjects derived from elements (no separate API call)
- Efficient for reducing API calls

### List Operations
```typescript
// Extract unique subjects (avoiding duplicates)
const subjectMap = new Map<number, Subject>();
elements.forEach(el => {
  if (!subjectMap.has(el.subject_id)) {
    subjectMap.set(el.subject_id, {...});
  }
});

// Sort alphabetically
this.subjects = Array.from(subjectMap.values())
  .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
```

## Accessibility Features

- `<label for="subjectSelect">` - Label associations for screen readers
- `[disabled]="!selectedSubjectId"` - Disabled state feedback
- `.help-text` - Helpful messages for all fields
- Keyboard navigation: Tab between fields works natively
- Color contrast: Text on background meets WCAG AA standards
- Button focus states: Clear visual feedback for keyboard users

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

Uses standard CSS Grid, Flexbox, and Angular features available in Angular 17+
