export type DragDropExerciseV1 = {
  version: 1;
  instructions?: string;
  settings: {
    shuffleItems: boolean;
    allowMultiplePerZone: boolean; // default true
    snapToZone: boolean; // default true
    scoring: 'all-or-nothing' | 'per-item' | 'none';
    showInstantFeedback: boolean; // preview/player behavior hint
    backgroundColor?: string; // page background color
    contentBackgroundColor?: string; // content area background
    zoneBackgroundColor?: string; // drop zone background
    zoneTextColor?: string; // drop zone text color
    zoneBorderColor?: string; // default zone border color
  };
  zones: Array<{
    id: string;            // uuid
    title: string;
    description?: string;
    accepts?: string[];    // optional category tags this zone accepts
    color?: string;        // tailwind token or hex
  }>;
  items: Array<{
    id: string;            // uuid
    text: string;
    color?: string;
    correctZoneId: string; // required
    altCorrectZoneIds?: string[];
    points?: number;       // default 1
    feedback?: {
      correct?: string;
      incorrect?: string;
    };
  }>;
};

export type ItemPlacement = {
  itemId: string;
  zoneId: string | null; // null means unassigned
};