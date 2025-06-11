import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TmdbSessionIdComponent } from './tmdb-session-id.component';

describe('TmdbSessionIdComponent', () => {
  let component: TmdbSessionIdComponent;
  let fixture: ComponentFixture<TmdbSessionIdComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TmdbSessionIdComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TmdbSessionIdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
