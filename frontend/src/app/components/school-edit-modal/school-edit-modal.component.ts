import { Component, inject, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { School, SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-school-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './school-edit-modal.component.html',
  styleUrls: ['./school-edit-modal.component.scss']
})
export class SchoolEditModalComponent {
  private fb = inject(FormBuilder);
  private schoolService = inject(SchoolService);
  @Input() school?: School | null = null;
  @Output() saved = new EventEmitter<School>();
  @Output() closed = new EventEmitter<void>();

  districts: string[] = ['Abim', 'Adjumani', 'Agago', 'Alebtong', 'Amolatar', 'Amudat', 'Amuria', 'Amuru', 'Apac', 'Arua', 'Budaka', 'Bududa', 'Bugiri', 'Bugweri', 'Bugutu', 'Buikwe', 'Bukedea', 'Bukomansimbi', 'Bukwa', 'Bulambuli', 'Buliisa', 'Bundibugyo', 'Bushenyi', 'Busia', 'Butaleja', 'Butambala', 'Buvuma', 'Buyende', 'Dokolo', 'Gomba', 'Gulu', 'Hoima', 'Ibanda', 'Iganga', 'Isingiro', 'Jinja', 'Kaabong', 'Kabale', 'Kabarole', 'Kaberamaido', 'Kalangala', 'Kaliro', 'Kalungu', 'Kampala', 'Kamuli', 'Kamwenge', 'Kanungu', 'Kapchorwa', 'Kasese', 'Katakwi', 'Kayunga', 'Kazo', 'Kibaale', 'Kiboga', 'Kibuku', 'Kisoro', 'Kitatta', 'Kitgum', 'Koboko', 'Kole', 'Kotido', 'Kumi', 'Kwania', 'Kween', 'Kyegegwa', 'Kyenjojo', 'Kyaka', 'Kyankwanzi', 'Kyotera', 'Lamwo', 'Lira', 'Luuka', 'Luwero', 'Lwengo', 'Lyantonde', 'Manafwa', 'Maracha', 'Mbarara', 'Mbale', 'Mitooma', 'Mityana', 'Moroto', 'Moyo', 'Mpigi', 'Mukono', 'Nabilatuk', 'Nakapiripirit', 'Nakaseke', 'Nakasongola', 'Namayingo', 'Namisindwa', 'Namutumba', 'Napak', 'Nebbi', 'Ngora', 'Ntoroko', 'Ntungamo', 'Nwoya', 'Omoro', 'Otuke', 'Pader', 'Pakwach', 'Pallisa', 'Rakai', 'Rubirizi', 'Rukiga', 'Rukungiri', 'Sembabule', 'Serere', 'Sheema', 'Sironko', 'Soroti', 'Tororo', 'Wakiso', 'Yumbe'];
  studentCountRanges: string[] = ['<500', '501-1000', '1001-2000', '>2000'];
  schoolTypes: string[] = [
    'Nursery School / Kindergarten',
    'Primary School (Local)',
    'Secondary School (Local)',
    'Nursery & Primary School (Local)',
    'International Primary',
    'International Secondary'
  ];

  form = this.fb.group({
    school_name: ['', [Validators.required, Validators.maxLength(120)]],
    admin_phone: ['', [Validators.required]],
    accountant_number: [''],
    location_district: [''],
    student_count_range: [''],
    school_type: ['']
  });

  // When used as a parent-driven modal, patch the form when `school` input changes
  ngOnChanges(changes: SimpleChanges) {
    if (changes['school'] && this.school) {
      const s = this.school;
      this.form.patchValue({
        school_name: s.school_name || '',
        admin_phone: s.admin_phone || '',
        accountant_number: s.accountant_number || '',
        location_district: s.location_district || '',
        student_count_range: s.student_count_range || '',
        school_type: s.school_type || ''
      });
    }
  }

  save(): void {
    if (this.form.invalid || !this.school) return;
    const val = this.form.value;
    const updates: Partial<School> = {
      school_name: val.school_name || undefined,
      admin_phone: val.admin_phone || undefined,
      accountant_number: val.accountant_number || undefined,
      location_district: val.location_district || undefined,
      student_count_range: val.student_count_range || undefined,
      school_type: val.school_type || undefined
    };

    console.log('[SchoolEditModal] Updating school:', this.school.school_id, 'with:', updates);
    this.schoolService.updateMySchool(this.school.school_id, updates).subscribe({
      next: (updated) => {
        console.log('[SchoolEditModal] Update successful:', updated);
        // emit updated school to parent
        this.saved.emit(updated);
      },
      error: (err) => {
        console.error('[SchoolEditModal] Failed to update school', err);
        alert('Failed to update school: ' + (err?.error?.message || err?.message || 'Unknown error'));
      }
    });
  }

  cancel(): void {
    this.closed.emit();
  }
}
