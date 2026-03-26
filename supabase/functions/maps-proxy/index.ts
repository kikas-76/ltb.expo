import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Maps-Key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    const mapsKey =
      Deno.env.get("GOOGLE_MAPS_KEY") ??
      req.headers.get("X-Maps-Key") ??
      "";

    if (!mapsKey) {
      return new Response(JSON.stringify({ error: "Missing Maps API key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let googleUrl: string;

    if (endpoint === "autocomplete") {
      const input = url.searchParams.get("input") ?? "";
      googleUrl =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&language=fr` +
        `&key=${mapsKey}`;
    } else if (endpoint === "details") {
      const placeId = url.searchParams.get("place_id") ?? "";
      googleUrl =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${placeId}` +
        `&fields=formatted_address,geometry,address_components` +
        `&language=fr` +
        `&key=${mapsKey}`;
    } else if (endpoint === "geocode") {
      const latlng = url.searchParams.get("latlng") ?? "";
      googleUrl =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${latlng}` +
        `&language=fr` +
        `&key=${mapsKey}`;
    } else if (endpoint === "staticmap") {
      const lat = url.searchParams.get("lat") ?? "";
      const lng = url.searchParams.get("lng") ?? "";
      const zoom = url.searchParams.get("zoom") ?? "13";
      const size = url.searchParams.get("size") ?? "600x270";
      googleUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=${zoom}` +
        `&size=${size}` +
        `&scale=2` +
        `&maptype=roadmap` +
        `&style=feature:poi|visibility:off` +
        `&style=feature:transit|visibility:off` +
        `&key=${mapsKey}`;

      const imgRes = await fetch(googleUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      return new Response(imgBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } else {
      return new Response(JSON.stringify({ error: "Unknown endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const googleRes = await fetch(googleUrl);
    const data = await googleRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
