import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcessMonitor } from '@src/\1.js';

describe('ProcessMonitor', () => {
  let component: ProcessMonitor;
  let fixture: ComponentFixture<ProcessMonitor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessMonitor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProcessMonitor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
