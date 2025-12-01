import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
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
  // List of Uganda districts for the district dropdown.
  districts = [
    'Abim', 'Adjumani', 'Agago', 'Alebtong', 'Amolatar', 'Amuria', 'Amuru', 'Apac', 'Arua', 'Budaka', 'Bududa', 'Bugiri', 'Bugweri', 'Bugungu', 'Buikwe', 'Bukedea', 'Bukomansimbi', 'Bukwa', 'Bulambuli', 'Buliisa', 'Bundibugyo', 'Bunyangabu', 'Bushenyi', 'Busia', 'Butaleja', 'Butambala', 'Buvuma', 'Buyende', 'Dokolo', 'Gomba', 'Gulu', 'Hoima', 'Ibanda', 'Iganga', 'Isingiro', 'Jinja', 'Kaabong', 'Kabale', 'Kabarole', 'Kaberamaido', 'Kalangala', 'Kaliro', 'Kalungu', 'Kampala', 'Kamuli', 'Kamwenge', 'Kanungu', 'Kapchorwa', 'Karenga', 'Kasese', 'Katakwi', 'Kayunga', 'Kazo', 'Kibale', 'Kiboga', 'Kibuku', 'Kikuube', 'Kayunga', 'Kiruhura', 'Kiryandongo', 'Kisoro', 'Kitgum', 'Koboko', 'Kole', 'Kotido', 'Kumi', 'Kween', 'Kyankwanzi', 'Kyegegwa', 'Kyotera', 'Lamwo', 'Lira', 'Luuka', 'Luwero', 'Lyantonde', 'Manafwa', 'Maracha', 'Masaka', 'Masindi', 'Mayuge', 'Mbale', 'Mbarara', 'Mitooma', 'Mityana', 'Moroto', 'Moyo', 'Mpigi', 'Mukono', 'Nakaseke', 'Nakapiripirit', 'Nakaseke', 'Nakasongola', 'Namayingo', 'Namisindwa', 'Namutumba', 'Napak', 'Nebbi', 'Ngora', 'Ntoroko', 'Oyam', 'Pakwach', 'Pallisa', 'Rakai', 'Rukungiri', 'Rubanda', 'Rukiga', 'Rukungiri', 'Rwampara', 'Sembabule', 'Serere', 'Sheema', 'Sironko', 'Soroti', 'Tororo', 'Wakiso', 'Yumbe'
  ];

  selectedFile: File | null = null;
  uploadProgress: number = 0;
  isUploading: boolean = false;
  previewUrl: string | null = null;

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

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit(): void {
    if (this.schoolForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const schoolData = this.schoolForm.value;

    this.schoolService.createSchool(schoolData).subscribe({
      next: (createdSchool) => {
        if (this.selectedFile) {
          this.isUploading = true;
          this.schoolService.uploadBadge(createdSchool.school_id, this.selectedFile).subscribe({
            next: (event) => {
              if (event.type === HttpEventType.UploadProgress) {
                this.uploadProgress = Math.round(100 * event.loaded / event.total);
              } else if (event.type === HttpEventType.Response) {
                this.isUploading = false;
                this.router.navigate(['/dashboard']);
              }
            },
            error: (err) => {
              console.error('Upload failed', err);
              this.isUploading = false;
              // Navigate anyway, badge upload failed but school created
              this.router.navigate(['/dashboard']);
            }
          });
        } else {
          this.router.navigate(['/dashboard']);
        }
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