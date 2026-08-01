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

/** Climate zone (default Cave Creek 85331). */
export const ZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  zip: z.string().min(1),
  last_frost: z.string().min(1),
  first_frost: z.string().min(1)
});
export type Zone = z.infer<typeof ZoneSchema>;

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

/** GET /api/crops/:id response. */
export const CropDetailResponseSchema = z.object({
  crop: CropSchema,
  windows: z.array(
    PlantingWindowSchema.extend({
      source: SourceSchema
    })
  )
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

/** Query: optional ISO date YYYY-MM-DD for plantable-now. */
export const PlantableQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  method: MethodSchema.optional(),
  month: z.coerce.number().int().min(0).max(11).optional()
});
export type PlantableQuery = z.infer<typeof PlantableQuerySchema>;

/** Query filters for list/grid endpoints. */
export const FilterQuerySchema = z.object({
  method: MethodSchema.optional(),
  month: z.coerce.number().int().min(0).max(11).optional()
});
export type FilterQuery = z.infer<typeof FilterQuerySchema>;

/**
 * Query for GET /api/crops — optional case-insensitive name search.
 * Empty or whitespace-only q is treated as absent (list all).
 */
export const CropsQuerySchema = z.object({
  q: z
    .string()
    .max(100)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    })
});
export type CropsQuery = z.infer<typeof CropsQuerySchema>;
