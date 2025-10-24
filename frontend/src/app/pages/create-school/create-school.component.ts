import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-create-school',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './create-school.component.html',
  styleUrls: ['./create-school.component.scss']
})
export class CreateSchoolComponent {
  schoolForm: FormGroup;
  errorMessage: string | null = null;
  // List of Uganda districts for the district dropdown. If you need to update
  // the list later, keep this centralized here. This list is a comprehensive
  // snapshot of districts commonly used; validate against an authoritative
  // source if you require exact canonical names.
  districts = [
    'Abim','Adjumani','Agago','Alebtong','Amolatar','Amuria','Amuru','Apac','Arua','Budaka','Bududa','Bugiri','Bugweri','Bugungu','Buikwe','Bukedea','Bukomansimbi','Bukwa','Bulambuli','Buliisa','Bundibugyo','Bunyangabu','Bushenyi','Busia','Butaleja','Butambala','Buvuma','Buyende','Dokolo','Gomba','Gulu','Hoima','Ibanda','Iganga','Isingiro','Jinja','Kaabong','Kabale','Kabarole','Kaberamaido','Kalangala','Kaliro','Kalungu','Kampala','Kamuli','Kamwenge','Kanungu','Kapchorwa','Karenga','Kasese','Katakwi','Kayunga','Kazo','Kibale','Kiboga','Kibuku','Kikuube','Kayunga','Kiruhura','Kiryandongo','Kisoro','Kitgum','Koboko','Kole','Kotido','Kumi','Kween','Kyankwanzi','Kyegegwa','Kyotera','Lamwo','Lira','Luuka','Luwero','Lyantonde','Manafwa','Maracha','Masaka','Masindi','Mayuge','Mbale','Mbarara','Mitooma','Mityana','Moroto','Moyo','Mpigi','Mukono','Nakaseke','Nakapiripirit','Nakaseke','Nakasongola','Namayingo','Namisindwa','Namutumba','Napak','Nebbi','Ngora','Ntoroko','Oyam','Pakwach','Pallisa','Rakai','Rukungiri','Rubanda','Rukiga','Rukungiri','Rwampara','Sembabule','Serere','Sheema','Sironko','Soroti','Tororo','Wakiso','Yumbe'
  ];

  constructor(
    private fb: FormBuilder,
    private schoolService: SchoolService,
    private router: Router
  ) {
    this.schoolForm = this.fb.group({
      school_name: ['', Validators.required],
      admin_phone: ['', Validators.required],
      accountant_number: ['', Validators.required],
      location_district: ['', Validators.required],
      school_type: ['', Validators.required],
      student_count_range: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.schoolForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const schoolData = this.schoolForm.value;

    this.schoolService.createSchool(schoolData).subscribe({
      next: () => {
        // On success, redirect to the dashboard.
        // The dashboard will then re-fetch the school data and show the main view.
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        if (err.status === 400 && err.error?.message === 'User is already associated with a school.') {
            this.errorMessage = err.error.message;
        } else {
            this.errorMessage = 'An unexpected error occurred. Please try again.';
        }
        console.error(err);
      }
    });
  }
}