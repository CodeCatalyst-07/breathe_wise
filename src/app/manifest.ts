import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BreatheWise - Urban Air Quality Assistant",
    short_name: "BreatheWise",
    description:
      "Actionable, low-emission daily routines and indoor smog hacks for severe winter pollution in Indian cities.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F5F6",
    theme_color: "#14262F",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
