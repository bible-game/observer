
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hud.component.html',
  styleUrls: ['./hud.component.sass']
})
export class HudComponent {
  @Output() timeChange = new EventEmitter<number>();
  @Output() latitudeChange = new EventEmitter<number>();
  @Output() fovChange = new EventEmitter<number>();
  @Output() toggleLabels = new EventEmitter<void>();
  @Output() toggleConstellations = new EventEmitter<void>();
  @Output() regenerateStars = new EventEmitter<void>();

  time = 12;
  latitude = 34;
  fov = 75;

  onTimeChange(value: string) {
    this.time = parseFloat(value);
    this.timeChange.emit(this.time);
  }

  onLatitudeChange(value: string) {
    this.latitude = parseFloat(value);
    this.latitudeChange.emit(this.latitude);
  }

  onFovChange(value: string) {
    this.fov = parseFloat(value);
    this.fovChange.emit(this.fov);
  }
}
