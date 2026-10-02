export interface RealCircuitPoint {
  dist: number;
  x: number;
  y: number;
}

export interface RealCircuitCorner {
  name: string;
  shortName: string;
  dist: number;
  x: number;
  y: number;
  radius?: number;
}

export interface TrackDrsZone {
  name: string;
  start: number;
  end: number;
}

export interface TrackSector {
  sector: number;
  dist: number;
}

export type CircuitCategory = "f1" | "gt" | "wec" | "classic";

export interface RealCircuitDefinition {
  id: string;
  name: string;
  officialDistance: number;
  fiaGrade: string;
  country: string;
  category: CircuitCategory;
  drsZones: TrackDrsZone[];
  sectors: TrackSector[];
  points: RealCircuitPoint[];
  corners: RealCircuitCorner[];
}

export interface CircuitMetadataItem {
  id: string;
  name: string;
  officialDistance: number;
  fiaGrade: string;
  country: string;
  category: CircuitCategory;
  cornerCount: number;
}
