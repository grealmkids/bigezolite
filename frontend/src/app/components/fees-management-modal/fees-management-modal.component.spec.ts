import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeesManagementModalComponent } from './fees-management-modal.component';

describe('FeesManagementModalComponent', () => {
  let component: FeesManagementModalComponent;
  let fixture: ComponentFixture<FeesManagementModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeesManagementModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeesManagementModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
