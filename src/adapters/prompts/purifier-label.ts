import { z } from "zod";

export const PurifierLabelOutputSchema = z.object({
  cadr: z.number().nullable(),
  unit: z.enum(["m3h", "cfm", "unknown"]),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type PurifierLabelOutput = z.infer<typeof PurifierLabelOutputSchema>;

export function buildPurifierLabelPrompt(imageBase64: string, mimeType: string) {
  const system = `You are a technical document inspection assistant specialized in household air cleaner specification stickers.
Inspect the provided image of an air purifier specification label or technical plate.
Locate Clean Air Delivery Rate (CADR), air flow rate, or particulate filtering volume.
Extract:
- cadr: Numeric value (e.g. 260, 350, 400). If not clearly visible, return null.
- unit: "m3h" if in m³/h or m3/hr; "cfm" if in CFM / ft³/min; "unknown" if unspecified.
- brand: Manufacturer name if visible (e.g. Philips, Coway, Xiaomi, Dyson, Honeywell).
- model: Model name or number if visible.
- confidence: "high" if CADR is explicitly printed with units, "medium" if airflow is inferred, "low" if blurry or uncertain.

Return ONLY a JSON object matching this schema:
\`\`\`json
{
  "cadr": 300,
  "unit": "m3h",
  "brand": "BrandName",
  "model": "ModelName",
  "confidence": "high"
}
\`\`\``;

  const userContent = [
    {
      type: "text" as const,
      text: "Please extract the CADR, airflow specifications, brand, and model from this purifier label.",
    },
    {
      type: "image_url" as const,
      image_url: {
        url: `data:${mimeType};base64,${imageBase64}`,
      },
    },
  ];

  return { system, userContent };
}
