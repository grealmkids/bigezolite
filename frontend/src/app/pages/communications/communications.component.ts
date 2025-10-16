import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { CommunicationService } from '../../services/communication.service';

@Component({
  selector: 'app-communications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './communications.component.html',
  styleUrls: ['./communications.component.scss']
})
export class CommunicationsComponent implements OnInit {
  message = '';
  characterCount = 0;
  smsCreditsConsumed = 1;
  recipientFilter = 'All Students';
  classes: string[] = [];

  constructor(
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    public communicationService: CommunicationService
  ) { }

   ngOnInit(): void {
     // Populate classes dropdown based on localStorage schoolType only
     try {
       const schoolType = this.schoolService.getSelectedSchoolType();
       if (schoolType) {
         this.classes = this.classCategorizationService.getClassesForSchoolType(schoolType);
       } else {
         this.classes = [];
       }
     } catch (err) {
       this.classes = [];
     }
  }

  onMessageChange(message: string): void {
    this.message = message;
    this.characterCount = message.length;
    this.smsCreditsConsumed = Math.ceil(message.length / 160);
  }

  sendBulkSms(): void {
    if (this.message) {
      this.communicationService.sendBulkSms(this.recipientFilter, this.message).subscribe(() => {
        // Handle success
        this.message = '';
        this.recipientFilter = 'All Students';
      });
    }
  }
}