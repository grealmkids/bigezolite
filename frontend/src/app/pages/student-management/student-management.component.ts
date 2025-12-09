import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'noDash' })
export class NoDashPipe implements PipeTransform {
  transform(value: string): string {
    return value ? value.split('-').join('') : '';
  }
}
import { Component, OnInit } from '@angular/core';
import { LoadingService } from '../../services/loading.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable, Subject, combineLatest, BehaviorSubject, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith, take, map } from 'rxjs/operators';
import { Student, StudentService } from '../../services/student.service';
import { FeesService, FeeRecord } from '../../services/fees.service';
import { CommonModule } from '@angular/common';
import { StudentModalComponent } from '../../components/student-modal/student-modal.component';
import { FeesManagementModalComponent } from '../../components/fees-management-modal/fees-management-modal.component';
import { SmsStudentModalComponent } from '../../components/sms-student-modal/sms-student-modal.component';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { PdfExportService } from '../../services/pdf-export.service';
import { FeesToTrackService } from '../../services/fees-to-track.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { PdfOptionsDialogComponent } from '../../components/pdf-options-dialog/pdf-options-dialog.component';

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [
    CommonModule,
    StudentModalComponent,
    FeesManagementModalComponent,
    SmsStudentModalComponent,
    LoadingSpinnerComponent,
    MatPaginatorModule,
    MatProgressBarModule,
    NoDashPipe,
    MatDialogModule
  ],
  templateUrl: './student-management.component.html',
  styleUrls: ['./student-management.component.scss']
})
export class StudentManagementComponent implements OnInit {
  students$: Observable<{ items: Student[]; total: number }> | undefined;
  displayedStudents: Student[] = [];
  // When fees filter is selected, we build fee rows for the current page
  displayedFeeRows: Array<{ reg: string; lin?: string; name: string; klass: string; category: string; feesStatus: string; term?: number; year?: number; total?: number; paid?: number; balance?: number; phone: string }> = [];
  loadingFees = false;
  isLoading = false;
  private searchTerms = new Subject<string>();
  private classFilter = new BehaviorSubject<string>('');
  private statusFilter = new BehaviorSubject<string>('');
  private feesStatusFilter = new BehaviorSubject<string>('');
  private yearFilter = new BehaviorSubject<string>('');
  private termFilter = new BehaviorSubject<string>('');
  private pageIndex = new BehaviorSubject<number>(0);
  private pageSize = new BehaviorSubject<number>(10);
  private sortColumn = new BehaviorSubject<string>('student_name');
  private sortDirection = new BehaviorSubject<'ASC' | 'DESC'>('ASC');

  // Track latest search term for exports (avoid changing Subject to BehaviorSubject)
  private lastSearchTerm: string = '';

  // Manual refresh trigger (emits to force re-query with current filters)
  private refreshTick = new Subject<void>();

  // Pagination settings
  pageEvent: PageEvent = {
    pageIndex: 0,
    pageSize: 10,
    length: 0
  };

  isStudentModalOpen = false;
  isFeesModalOpen = false;
  isSmsModalOpen = false;
  selectedStudent: Student | null = null;

  classes: string[] = [];
  years = ['2023', '2024', '2025']; // This can also be dynamic
  loadingClasses = false;

  constructor(
    private studentService: StudentService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private loadingService: LoadingService,
    private snack: MatSnackBar,
    private pdfExportService: PdfExportService,
    private dialog: MatDialog,
    private feesService: FeesService,
    private feesToTrackService: FeesToTrackService
  ) { }

  onSearch(term: string): void {
    // Reset to first page whenever filters/search changes
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.lastSearchTerm = term || '';
    this.searchTerms.next(term);
  }

  onClassChange(term: string): void {
    // Ensure string type and handle empty string
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.classFilter.next(term ? String(term) : '');
  }

  onStatusChange(term: string): void {
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.statusFilter.next(term);
  }

  onFeesStatusChange(term: string): void {
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.feesStatusFilter.next(term);
  }

  onYearChange(term: string): void {
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.yearFilter.next(term);
  }

  onTermChange(term: string): void {
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.termFilter.next(term);
  }

  onPageChange(event: PageEvent): void {
    this.pageEvent = event;
    this.pageIndex.next(event.pageIndex);
    this.pageSize.next(event.pageSize);
  }

  onSort(column: string): void {
    if (this.sortColumn.value === column) {
      // Toggle direction
      this.sortDirection.next(this.sortDirection.value === 'ASC' ? 'DESC' : 'ASC');
    } else {
      // Set new column, default to ASC
      this.sortColumn.next(column);
      this.sortDirection.next('ASC');
    }
    // Reset to first page
    this.pageIndex.next(0);
  }

  // Helper methods for template-driven pagination controls
  get totalPages(): number {
    const length = this.pageEvent.length || 0;
    const size = this.pageEvent.pageSize || 10;
    return Math.max(1, Math.ceil(length / size));
  }

  prevPage(): void {
    if (this.pageEvent.pageIndex > 0) {
      const newIndex = this.pageEvent.pageIndex - 1;
      this.pageEvent.pageIndex = newIndex;
      this.pageIndex.next(newIndex);
    }
  }

  nextPage(): void {
    const maxPageIndex = Math.max(0, this.totalPages - 1);
    if (this.pageEvent.pageIndex < maxPageIndex) {
      const newIndex = this.pageEvent.pageIndex + 1;
      this.pageEvent.pageIndex = newIndex;
      this.pageIndex.next(newIndex);
    }
  }

  changePageSize(size: number): void {
    this.pageEvent.pageSize = size;
    this.pageEvent.pageIndex = 0;
    this.pageSize.next(size);
    this.pageIndex.next(0);
  }

  ngOnInit(): void {
    this.loadingClasses = true;
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      this.classes = schoolType ? this.classCategorizationService.getClassesForSchoolType(schoolType) : [];
    } catch (err) {
      this.classes = [];
    } finally {
      this.loadingClasses = false;
    }

    this.students$ = combineLatest([
      this.searchTerms.pipe(debounceTime(300), distinctUntilChanged(), startWith('')),
      this.classFilter.pipe(distinctUntilChanged(), startWith('')),
      this.statusFilter.pipe(distinctUntilChanged(), startWith('')),
      this.feesStatusFilter.pipe(distinctUntilChanged(), startWith('')),
      this.yearFilter.pipe(distinctUntilChanged(), startWith('')),
      this.termFilter.pipe(distinctUntilChanged(), startWith('')),
      this.pageIndex.pipe(distinctUntilChanged(), startWith(0)),
      this.pageSize.pipe(distinctUntilChanged(), startWith(10)),
      this.sortColumn.pipe(distinctUntilChanged(), startWith('student_name')),
      this.sortDirection.pipe(distinctUntilChanged(), startWith('ASC')),
      this.refreshTick.pipe(startWith(void 0))
    ]).pipe(
      switchMap(([searchTerm, classTerm, statusTerm, feesStatusTerm, yearTerm, termSel, page, limit, sort, order]) => {
        this.isLoading = true;
        const schoolId = this.schoolService.getSelectedSchoolId();
        if (!schoolId) {
          console.error('[StudentManagement] No schoolId selected');
          this.isLoading = false;
          return of({ items: [], total: 0 });
        }
        // For per-term fees view, fetch students without backend feesStatus filtering to avoid masking term balances
        const effectiveFeesStatus = (feesStatusTerm && feesStatusTerm.trim()) ? '' : feesStatusTerm;
        return this.studentService.getStudents(schoolId, searchTerm, classTerm, statusTerm, effectiveFeesStatus, yearTerm, termSel || '', page, limit, sort, order);
      })
    );

    this.students$.subscribe({
      next: (resp) => {
        this.displayedStudents = resp.items || [];
        this.pageEvent.length = resp.total;
        this.isLoading = false;
        // Build fees table rows if fees status filter is active
        if (this.hasFeesFilter()) {
          this.buildFeesRowsFor(this.displayedStudents);
        } else {
          this.displayedFeeRows = [];
        }
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err?.error?.message || 'Failed to load students';
        this.snack.open(msg, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
      }
    });
  }

  // Student Modal Methods
  openStudentModal(student: Student | null = null): void {
    if (student && student.student_id) {
      const schoolId = this.schoolService.getSelectedSchoolId();
      this.studentService.getStudentById(student.student_id, schoolId || undefined)
        .subscribe(fullStudent => {
          console.log('[Edit Modal] fetched student:', fullStudent);
          this.selectedStudent = fullStudent || student;
          this.isStudentModalOpen = true;
        });
    } else {
      this.selectedStudent = null;
      this.isStudentModalOpen = true;
    }
  }

  closeStudentModal(): void {
    this.isStudentModalOpen = false;
    this.selectedStudent = null;
  }

  onStudentUpserted(): void {
    this.closeStudentModal();
    setTimeout(() => {
      this.refreshStudents(); // Force refresh the list after modal closes
    }, 100);
  }

  // Fees Management Modal Methods
  openFeesModal(student: Student): void {
    if (student && student.student_id) {
      const schoolId = this.schoolService.getSelectedSchoolId();
      this.studentService.getStudentById(student.student_id, schoolId || undefined)
        .subscribe(fullStudent => {
          console.log('[Fees Modal] fetched student:', fullStudent);
          this.selectedStudent = fullStudent || student;
          this.isFeesModalOpen = true;
        });
    } else {
      this.selectedStudent = null;
      this.isFeesModalOpen = true;
    }
  }

  closeFeesModal(): void {
    this.isFeesModalOpen = false;
    this.selectedStudent = null;
  }

  // SMS Modal Methods
  openSmsModal(student: Student): void {
    if (student && student.student_id) {
      const schoolId = this.schoolService.getSelectedSchoolId();
      this.studentService.getStudentById(student.student_id, schoolId || undefined)
        .subscribe(fullStudent => {
          console.log('[SMS Modal] fetched student:', fullStudent);
          this.selectedStudent = fullStudent || student;
          this.isSmsModalOpen = true;
        });
    } else {
      this.selectedStudent = null;
      this.isSmsModalOpen = true;
    }
  }

  closeSmsModal(): void {
    this.isSmsModalOpen = false;
    this.selectedStudent = null;
  }

  // Manual Refresh
  refreshStudents(): void {
    // Force an emission on the refresh stream to re-run the query with current filters
    this.refreshTick.next();
  }

  hasFeesFilter(): boolean {
    return !!(this.feesStatusFilter.value && this.feesStatusFilter.value.trim());
  }

  formatFeesStatus(v?: string | null): string {
    const s = (v || '').toLowerCase();
    return s === 'pending' ? 'Partially Paid' : (v || '');
  }

  deriveFeesStatus(total?: number, paid?: number, balance?: number): string {
    const b = Number(balance || 0);
    const p = Number(paid || 0);
    if (b <= 0) return 'Paid';
    if (p > 0) return 'Partially Paid';
    return 'Defaulter';
  }

  feesClassFromLabel(label: string): string {
    const s = (label || '').toLowerCase();
    if (s === 'partially paid') return 'pending';
    return s; // 'paid' | 'defaulter'
  }

  private buildFeesRowsFor(students: Student[]): void {
    if (!students || students.length === 0) { this.displayedFeeRows = []; return; }
    this.loadingFees = true;
    const requests = students.map(s => this.feesService.getFeeRecords(s.student_id).pipe(take(1)));
    forkJoin(requests).pipe(take(1)).subscribe({
      next: (recordsList: any[]) => {
        const filter = (this.feesStatusFilter.value || '').toLowerCase();
        const rows: Array<{ reg: string; lin?: string; name: string; klass: string; category: string; feesStatus: string; term?: number; year?: number; total?: number; paid?: number; balance?: number; phone: string }> = [];
        students.forEach((s, idx) => {
          const fees = (recordsList[idx] || []) as FeeRecord[];
          // filter by selected year and term (if provided)
          const ySel = this.yearFilter.value ? Number(this.yearFilter.value) : null;
          const tSel = this.termFilter.value ? Number(this.termFilter.value) : null;
          fees.filter(fr => (ySel ? fr.year === ySel : true) && (tSel ? fr.term === tSel : true)).forEach(fr => {
            const total = Number(fr.total_fees_due || 0);
            const paid = Number(fr.amount_paid || 0);
            const balance = Number(fr.balance_due ?? (total - paid));
            const status = this.deriveFeesStatus(total, paid, balance);
            // Apply per-record filter
            const st = status.toLowerCase();
            const include = !filter ||
              (filter === 'paid' && balance <= 0) ||
              ((filter === 'pending' || filter === 'partially paid') && balance > 0 && paid > 0) ||
              (filter === 'defaulter' && balance > 0);
            if (include) {
              rows.push({
                reg: (s.reg_number || '').replace(/-/g, ''),
                lin: s.lin,
                name: s.student_name || '',
                klass: s.class_name || '',
                category: s.student_status || '',
                feesStatus: status,
                term: fr.term,
                year: fr.year,
                total,
                paid,
                balance,
                phone: s.parent_phone_sms || ''
              });
            }
          });
        });
        this.displayedFeeRows = rows;
        this.loadingFees = false;
      },
      error: () => {
        this.loadingFees = false;
        this.displayedFeeRows = [];
      }
    });
  }

  // Delete Method
  deleteStudent(studentId: number): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Student',
        message: 'Are you sure you want to permanently delete this student and all associated fee records? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true
      },
      width: '420px'
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      const schoolId = this.schoolService.getSelectedSchoolId() || undefined;
      console.log('[StudentManagement] Confirmed delete for studentId=', studentId, 'schoolId=', schoolId);
      this.studentService.deleteStudent(studentId, schoolId).subscribe({
        next: () => {
          this.snack.open('Student deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
          this.searchTerms.next(''); // Refresh the list
        },
        error: (err) => {
          const msg = err?.error?.message || 'Failed to delete student';
          this.snack.open(msg, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
        }
      });
    });
  }

  isGeneratingPdf = false;

  // PDF Export Method
  downloadPDF(): void {
    if (this.displayedStudents.length === 0) {
      this.snack.open('No students to export', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    // Get all filtered students (not just current page)
    const schoolId = this.schoolService.getSelectedSchoolId();
    if (!schoolId) {
      this.snack.open('No school selected', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    // Check account status
    let accountStatus = 'Inactive';
    try {
      const schoolData = localStorage.getItem('bigezo_selected_school');
      if (schoolData) {
        const school = JSON.parse(schoolData);
        accountStatus = school?.account_status || 'Inactive';
      }
    } catch { }

    const isAccountActive = accountStatus.toLowerCase() === 'active';

    if (isAccountActive) {
      // Open options dialog
      const dialogRef = this.dialog.open(PdfOptionsDialogComponent, {
        width: '500px',
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(includePhotos => {
        if (includePhotos !== undefined) {
          this.proceedWithDownload(includePhotos);
        }
      });
    } else {
      // Default download (no photos)
      this.proceedWithDownload(false);
    }
  }

  proceedWithDownload(includePhotos: boolean): void {
    this.isGeneratingPdf = true;

    const schoolId = this.schoolService.getSelectedSchoolId();
    const searchTerm = this.lastSearchTerm;
    const classTerm = this.classFilter.value || '';
    const statusTerm = this.statusFilter.value || '';
    const yearTerm = this.yearFilter.value || '';
    const feesStatusTerm = this.feesStatusFilter.value || '';

    // Fetch ALL students matching the current filters (no pagination)
    this.studentService.getStudents(
      schoolId!,
      searchTerm,
      classTerm,
      statusTerm,
      feesStatusTerm,
      yearTerm,
      this.termFilter.value || '',
      0,
      10000, // Large limit to get all students
      this.sortColumn.value,
      this.sortDirection.value
    ).subscribe({
      next: (resp) => {
        const allStudents = resp.items || [];

        if (allStudents.length === 0) {
          this.isGeneratingPdf = false;
          this.snack.open('No students found to export', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
          return;
        }

        // Compute header/meta first (used by both exports)
        let schoolName = 'School Registry';
        let badgeUrl: string | undefined;
        try {
          const schoolData = localStorage.getItem('bigezo_selected_school');
          if (schoolData) {
            const school = JSON.parse(schoolData);
            schoolName = school?.school_name || 'School Registry';
            badgeUrl = school?.badge_url;
          }
        } catch { }
        const filters: string[] = [];
        if (searchTerm) filters.push(`Search: \"${searchTerm}\"`);
        if (classTerm) filters.push(`Class: ${classTerm}`);
        if (statusTerm) filters.push(`Status: ${statusTerm}`);
        if (yearTerm) filters.push(`Year: ${yearTerm}`);
        const filterInfo = filters.length > 0 ? filters.join(', ') : undefined;
        const currentMonth = new Date().getMonth() + 1;
        let term = 'Term 1';
        if (currentMonth >= 5 && currentMonth <= 8) term = 'Term 2';
        else if (currentMonth >= 9 && currentMonth <= 12) term = 'Term 3';

        // If fees status filter is active, export fees details instead of student list
        if (feesStatusTerm) {
          const requests = allStudents.map(s => this.feesService.getFeeRecords(s.student_id).pipe(take(1)));
          forkJoin(requests).pipe(take(1)).subscribe({
            next: async (allFeeRecords: any[]) => {
              // Build per-term rows and filter per selected status, year, and term
              type Row = { reg: string; lin?: string; name: string; klass: string; feesStatus: string; feeName?: string; term: number | undefined; year: number | undefined; total: number | undefined; paid: number | undefined; balance: number | undefined; phone: string };
              const rows: Row[] = [];
              const filter = (feesStatusTerm || '').toLowerCase();
              const ySel = yearTerm ? Number(yearTerm) : new Date().getFullYear(); // enforce one year (default current)
              const tSel = this.termFilter.value ? Number(this.termFilter.value) : null;

              const neededFeeIds = new Set<number>();

              allStudents.forEach((s, idx) => {
                const fees: FeeRecord[] = (allFeeRecords[idx] || []) as FeeRecord[];
                fees.filter(fr => (fr.year === ySel) && (tSel ? fr.term === tSel : true)).forEach(fr => {
                  const total = Number(fr.total_fees_due || 0);
                  const paid = Number(fr.amount_paid || 0);
                  const balance = Number(fr.balance_due ?? (total - paid));
                  const status = this.deriveFeesStatus(total, paid, balance);
                  const include = !filter ||
                    (filter === 'paid' && balance <= 0) ||
                    ((filter === 'pending' || filter === 'partially paid') && balance > 0 && paid > 0) ||
                    (filter === 'defaulter' && balance > 0);
                  if (include) {
                    if (fr.fee_id) neededFeeIds.add(fr.fee_id as number);
                    rows.push({
                      reg: (s.reg_number || '').replace(/-/g, ''),
                      lin: s.lin,
                      name: s.student_name || '',
                      klass: s.class_name || '',
                      feesStatus: status,
                      term: fr.term,
                      year: fr.year,
                      total,
                      paid,
                      balance,
                      phone: s.parent_phone_sms || ''
                    });
                  }
                });
              });

              // Fetch fee names for unique fee_ids
              const idArr = Array.from(neededFeeIds);
              const nameMap: Record<number, string> = {};
              if (idArr.length) {
                try {
                  const nameCalls = idArr.map(id => this.feesToTrackService.getById(id).pipe(take(1)));
                  const defsPromise = forkJoin(nameCalls).pipe(take(1)).toPromise() as Promise<any[]>;
                  let defs: any[] = [];
                  try { defs = await defsPromise; } catch { }
                  defs?.forEach((d: any, i: number) => { nameMap[idArr[i]] = d?.name || 'School Fees'; });
                } catch {
                  // fallback names remain empty -> default later
                }
              }

              // Attach feeName by matching fee_id from original records again
              let recIdx = 0;
              allStudents.forEach((s, si) => {
                const fees: FeeRecord[] = (allFeeRecords[si] || []) as FeeRecord[];
                fees.filter(fr => (fr.year === ySel) && (tSel ? fr.term === tSel : true)).forEach(fr => {
                  if (recIdx < rows.length) {
                    const nm = fr.fee_id ? nameMap[fr.fee_id] || 'School Fees' : 'School Fees';
                    rows[recIdx].feeName = nm;
                    recIdx++;
                  }
                });
              });

              // Header options: hide Year (in header) and hide Term if selected
              const headerTerm = tSel ? `Term ${tSel}` : '';
              this.emitFeesPDF(rows, schoolName, headerTerm || 'All Terms', String(ySel), rows.length, filterInfo, { hideYear: true, hideTerm: !!tSel });
              this.isGeneratingPdf = false;
            },
            error: (err) => {
              console.error('Error fetching fees for export:', err);
              this.isGeneratingPdf = false;
              this.snack.open('Failed to fetch fees for export', 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar'],
                verticalPosition: 'top',
                horizontalPosition: 'center'
              });
            }
          });
          return;
        }

        // Generate PDF (student list)
        this.pdfExportService.generateStudentListPDF(allStudents, {
          schoolName: schoolName,
          term: term,
          year: yearTerm || new Date().getFullYear().toString(),
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          totalStudents: allStudents.length,
          filterInfo: filterInfo,
          badgeUrl: badgeUrl,
          includePhotos: includePhotos
        }).then(() => {
          this.isGeneratingPdf = false;
          this.snack.open(`PDF downloaded successfully (${allStudents.length} students)`, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
        }).catch(err => {
          this.isGeneratingPdf = false;
          console.error('Error generating PDF:', err);
          this.snack.open('Failed to generate PDF', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
        });
      },
      error: (err) => {
        console.error('Error fetching students for PDF:', err);
        this.isGeneratingPdf = false;
        this.snack.open('Failed to generate PDF', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
      }
    });
  }

  private emitFeesPDF(rows: any[], schoolName: string, term: string, year: string, total: number, filterInfo?: string, opts?: { hideYear?: boolean; hideTerm?: boolean }) {
    // Determine selected label/theme from current filter
    const raw = this.feesStatusFilter.value || '';
    const label = (raw.toLowerCase() === 'pending') ? 'Partially Paid' : raw;
    const theme = (raw.toLowerCase() === 'pending' || raw.toLowerCase() === 'partially paid')
      ? 'pending' : (raw.toLowerCase() === 'paid' ? 'paid' : (raw ? 'defaulter' : undefined));

    this.pdfExportService.generateFeesDetailsPDF(rows, {
      schoolName,
      term,
      year,
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }),
      totalStudents: total,
      filterInfo,
      statusLabel: label || undefined,
      statusTheme: theme as any,
      hideYear: opts?.hideYear,
      hideTerm: opts?.hideTerm,
    } as any);
    this.snack.open(`PDF downloaded successfully (${total} students)`, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      verticalPosition: 'top',
      horizontalPosition: 'center'
    });
  }
}
