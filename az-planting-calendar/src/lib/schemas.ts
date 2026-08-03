import { z } from 'zod';

/** Planting method: seed or transplant (az1005 legend). */
export const MethodSchema = z.enum(['S', 'T']);
export type Method = z.infer<typeof MethodSchema>;

/** Half-month index 0..23. */
export const HalfMonthSchema = z.number().int().min(0).max(23);

/** Source citation row. */
export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  retrieved_at: z.string().min(1)
});
export type Source = z.infer<typeof SourceSchema>;

/** Climate zone (default Cave Creek 85331). County + elevation from plan of record. */
export const ZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  zip: z.string().min(1),
  last_frost: z.string().min(1),
  first_frost: z.string().min(1),
  county: z.string().nullable().optional(),
  elevation_ft: z.number().int().nullable().optional(),
  /** USDA Plant Hardiness Zone (e.g. "9b", "10a"). Null when not sourced -- never invented. */
  usda_zone: z.string().nullable().optional()
});
export type Zone = z.infer<typeof ZoneSchema>;

/** Source column precision: what the publication actually supports. */
export const SourceGranularitySchema = z.enum(['month', 'half-month']);
export type SourceGranularity = z.infer<typeof SourceGranularitySchema>;

/** Crop row. */
export const CropSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  days_to_harvest_min: z.number().int().nullable(),
  days_to_harvest_max: z.number().int().nullable(),
  notes: z.string().nullable()
});
export type Crop = z.infer<typeof CropSchema>;

/** Planting window with optional nested source for API responses. */
export const PlantingWindowSchema = z.object({
  id: z.string().min(1),
  crop_id: z.string().min(1),
  start_half_month: HalfMonthSchema,
  end_half_month: HalfMonthSchema,
  method: MethodSchema,
  source_id: z.string().min(1),
  source_granularity: SourceGranularitySchema.optional().default('half-month'),
  source: SourceSchema.optional()
});
export type PlantingWindow = z.infer<typeof PlantingWindowSchema>;

/** Plantable-now card: crop + active method(s) + sources. */
export const PlantableItemSchema = z.object({
  crop: CropSchema,
  methods: z.array(MethodSchema).min(1),
  windows: z.array(PlantingWindowSchema).min(1)
});
export type PlantableItem = z.infer<typeof PlantableItemSchema>;

/** GET /api/plantable response. */
export const PlantableResponseSchema = z.object({
  half_month: HalfMonthSchema,
  half_month_label: z.string().min(1),
  date: z.string().min(1),
  zone: ZoneSchema,
  items: z.array(PlantableItemSchema)
});
export type PlantableResponse = z.infer<typeof PlantableResponseSchema>;

/** GET /api/crops list item. */
export const CropListItemSchema = CropSchema.extend({
  window_count: z.number().int().nonnegative()
});
export type CropListItem = z.infer<typeof CropListItemSchema>;

/** GET /api/crops response. */
export const CropsResponseSchema = z.object({
  crops: z.array(CropListItemSchema)
});

/**
 * Optional growing guidance on crop detail (how to plant).
 * Null fields were not stated in the cited source; never invented client-side.
 */
export const CropGuideSchema = z.object({
  depth: z.string().nullable(),
  spacing_in_row: z.string().nullable(),
  spacing_between_rows: z.string().nullable(),
  sun: z.string().nullable(),
  water: z.string().nullable(),
  harvest_note: z.string().nullable(),
  source: SourceSchema
});
export type CropGuide = z.infer<typeof CropGuideSchema>;

/** GET /api/crops/:id response. */
export const CropDetailResponseSchema = z.object({
  crop: CropSchema,
  windows: z.array(
    PlantingWindowSchema.extend({
      source: SourceSchema
    })
  ),
  /** Null when no sourced guide exists for this crop. */
  guide: CropGuideSchema.nullable().optional()
});
export type CropDetailResponse = z.infer<typeof CropDetailResponseSchema>;

/** Grid cell mark for one crop × half-month. */
export const GridCellSchema = z.object({
  half_month: HalfMonthSchema,
  methods: z.array(MethodSchema)
});

/** GET /api/grid response. */
export const GridResponseSchema = z.object({
  zone: ZoneSchema,
  crops: z.array(
    z.object({
      crop: CropSchema,
      cells: z.array(GridCellSchema).length(24)
    })
  )
});
export type GridResponse = z.infer<typeof GridResponseSchema>;

/** Health probe. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok')
});

/**
 * True when `value` is a real calendar YYYY-MM-DD (rejects 2026-02-31).
 *
 * @param value - Candidate date string already matching the ISO shape.
 */
function isValidCalendarIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Optional zone lookup: id, city fragment, or ZIP. */
export const ZoneParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional();

/**
 * Optional crop-name search fragment (plantable, grid, crops).
 * Empty or whitespace-only is treated as absent.
 */
const CropNameQuerySchema = z
  .string()
  .max(100)
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  });

/** Query: optional ISO date YYYY-MM-DD for plantable-now. */
export const PlantableQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidCalendarIsoDate, { message: 'invalid date' })
    .optional(),
  method: MethodSchema.optional(),
  month: z.coerce.number().int().min(0).max(11).optional(),
  zone: ZoneParamSchema,
  /** Case-insensitive crop name fragment; narrows plantable items. */
  q: CropNameQuerySchema
});
export type PlantableQuery = z.infer<typeof PlantableQuerySchema>;

/** Query filters for list/grid endpoints. */
export const FilterQuerySchema = z.object({
  method: MethodSchema.optional(),
  month: z.coerce.number().int().min(0).max(11).optional(),
  zone: ZoneParamSchema,
  /** Case-insensitive crop name fragment; narrows returned rows. */
  q: CropNameQuerySchema
});
export type FilterQuery = z.infer<typeof FilterQuerySchema>;

/** GET /api/zones?q= search query. */
export const ZonesQuerySchema = z.object({
  q: z
    .string()
    .max(80)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    })
});
export type ZonesQuery = z.infer<typeof ZonesQuerySchema>;

/** GET /api/zones response. */
export const ZonesResponseSchema = z.object({
  zones: z.array(ZoneSchema)
});
export type ZonesResponse = z.infer<typeof ZonesResponseSchema>;

/**
 * Query for GET /api/crops — optional case-insensitive name search.
 * Empty or whitespace-only q is treated as absent (list all).
 */
export const CropsQuerySchema = z.object({
  q: CropNameQuerySchema
});
export type CropsQuery = z.infer<typeof CropsQuerySchema>;

/** POST /api/assistant request body. */
export const AssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  zone: ZoneParamSchema
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/** Filters the assistant model may emit (validated server-side). */
export const AssistantFiltersSchema = z.object({
  half_month: HalfMonthSchema.optional(),
  method: MethodSchema.optional(),
  crop: z.string().min(1).max(100).optional()
});
export type AssistantFilters = z.infer<typeof AssistantFiltersSchema>;

/** One crop row returned after D1 grounding. */
export const AssistantCropSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  methods: z.array(MethodSchema)
});

/** POST /api/assistant success response — answer is code-built from D1, not model prose. */
export const AssistantResponseSchema = z.object({
  answer: z.string().min(1),
  crops: z.array(AssistantCropSchema),
  filters: AssistantFiltersSchema
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
