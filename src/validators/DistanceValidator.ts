import { Location } from '../types/player.types';
import { Basecamp } from '../types/room.types';
import { ValidationResult } from '../types/game.types';
import { calculateDistance } from '../utils/distance';
import { MAX_LOCATION_AGE_MS } from '../utils/constants';

export class DistanceValidator {
  validateCapture(
    policeLocation: Location | null,
    thiefLocation: Location | null,
    captureRadiusMeters: number,
    maxLocationAgeMs: number = MAX_LOCATION_AGE_MS
  ): ValidationResult {
    const now = Date.now();

    if (!policeLocation || now - policeLocation.updatedAt > maxLocationAgeMs) {
      return { valid: false, distance: 0, error: 'Police location outdated or missing' };
    }

    if (!thiefLocation || now - thiefLocation.updatedAt > maxLocationAgeMs) {
      return { valid: false, distance: 0, error: 'Thief location outdated or missing' };
    }

    const distance = calculateDistance(
      policeLocation.lat,
      policeLocation.lng,
      thiefLocation.lat,
      thiefLocation.lng
    );

    if (distance > captureRadiusMeters) {
      return { valid: false, distance, error: `Too far: ${distance.toFixed(1)}m` };
    }

    return { valid: true, distance };
  }

  validateJail(
    policeLocation: Location | null,
    basecamp: Basecamp | null,
    jailRadiusMeters: number,
    maxLocationAgeMs: number = MAX_LOCATION_AGE_MS
  ): ValidationResult {
    const now = Date.now();

    if (!policeLocation || now - policeLocation.updatedAt > maxLocationAgeMs) {
      return { valid: false, distance: 0, error: 'Police location outdated or missing' };
    }

    if (!basecamp) {
      return { valid: false, distance: 0, error: 'Basecamp not set' };
    }

    const distance = calculateDistance(
      policeLocation.lat,
      policeLocation.lng,
      basecamp.lat,
      basecamp.lng
    );

    if (distance > jailRadiusMeters) {
      return { valid: false, distance, error: `Not at basecamp: ${distance.toFixed(1)}m` };
    }

    return { valid: true, distance };
  }
}
