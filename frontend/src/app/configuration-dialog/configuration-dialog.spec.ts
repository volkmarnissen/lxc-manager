import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigurationDialog } from '@src/\1.js';

describe('ConfigurationDialog', () => {
  let component: ConfigurationDialog;
  let fixture: ComponentFixture<ConfigurationDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigurationDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigurationDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
