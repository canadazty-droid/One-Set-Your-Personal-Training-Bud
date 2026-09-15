export type CatalogExerciseIndex = {
  id: string;
  source: "exercises-dataset" | "free-exercise-db" | "wger";
  sourceId: string;
  name: string;
  category: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  level?: string;
  force?: string;
  mechanic?: string;
  trainingReadyId?: string;
};

export type CatalogExerciseDetail = CatalogExerciseIndex & {
  instructionStepsZh: string[];
  instructionStepsEn: string[];
  license?: string;
  licenseUrl?: string;
  licenseAuthor?: string;
  sourceUrl?: string;
};

export { EXERCISE_CATALOG_COUNT, EXERCISE_CATALOG_SOURCE_COUNTS } from "./exercise-catalog-manifest";
export const EXERCISE_CATALOG_INDEX_URL = "/data/exercises-catalog-index.json";
export const exerciseCatalogDetailUrl = (id: string) =>
  `/data/exercises-catalog-details/${id.slice(0, 2)}.json`;
