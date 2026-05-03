function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

function getBest(videos, quality) {
  if (quality) {
    const found = videos.find(
      x => x.name.toLowerCase() === quality.toLowerCase()
    );
    if (found) return found;
  }
  return videos[videos.length - 1];
}

async function loadMeta(id) {
  const html = await fetch(`https://ok.ru/videoembed/${id}`, {
    headers: { "User-Agent": "Mozilla/5.0" }
  }).then(r => r.text());

  const match = html.match(/data-options="([^"]+)"/);

  if (!match) throw new Error("Meta bulunamadı");

  const options = JSON.parse(decodeHtml(match[1]));

  return JSON.parse(options.flashvars.metadata);
}

/*
  STREAM PROXY (TV SAFE)
*/
async function proxyFile(fileUrl, request) {
  if (!fileUrl) {
    return new Response("Missing file url", { status: 400 });
  }

  const headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*"
  };

  const range = request.headers.get("range");
  if (range) headers["Range"] = range;

  const upstream = await fetch(fileUrl, { headers });

  const out = new Headers();

  const pass = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges"
  ];

  for (const key of pass) {
    const value = upstream.headers.get(key);
    if (value) out.set(key, value);
  }

  out.set("Access-Control-Allow-Origin", "*");
  out.set("Accept-Ranges", "bytes");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: out
  });
}

/*
  TV COMPATIBLE HLS
*/
function buildHls(sourceUrl, origin) {
  return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10,
${origin}/seg?u=${encodeURIComponent(sourceUrl)}
#EXT-X-ENDLIST`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    /*
      SEGMENT
    */
    if (url.pathname === "/seg") {
      const file = url.searchParams.get("u");
      return await proxyFile(file, request);
    }

    const path = url.pathname.replace("/", "");
    const quality = url.searchParams.get("q");

    const id = path
      .replace(".json", "")
      .replace(".m3u8", "")
      .replace(".mp4", "");

    const meta = await loadMeta(id);
    const selected = getBest(meta.videos, quality);

    /*
      JSON API
    */
    if (path.endsWith(".json")) {
      return Response.json({
        id,
        title: meta.movie?.title,
        source: selected.url,
        qualities: meta.videos.map(x => x.name)
      });
    }

    /*
      TV FRIENDLY M3U8
    */
    if (path.endsWith(".m3u8")) {
      const body = buildHls(selected.url, url.origin);

      return new Response(body, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    /*
      MP4 fallback
    */
    return Response.redirect(selected.url, 302);
  }
};
