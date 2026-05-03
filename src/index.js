function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

function getBest(videos, quality) {

  if (quality) {

    const found =
      videos.find(
        x =>
          x.name
            .toLowerCase() ===
          quality
            .toLowerCase()
      );

    if (found) {
      return found;
    }
  }

  return videos[
    videos.length - 1
  ];
}


async function loadMeta(id) {

  const html =
    await fetch(
      `https://ok.ru/videoembed/${id}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    ).then(
      r => r.text()
    );


  const match =
    html.match(
      /data-options="([^"]+)"/
    );


  const options =
    JSON.parse(
      decodeHtml(
        match[1]
      )
    );


  return JSON.parse(
    options
      .flashvars
      .metadata
  );
}


/*
 segment proxy
*/
async function proxyFile(
  fileUrl
) {

  const upstream =
    await fetch(
      fileUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    );

  return new Response(
    upstream.body,
    {
      headers: {

        "Content-Type":
          upstream.headers.get(
            "content-type"
          ) || "video/mp4",

        "Accept-Ranges":
          "bytes",

        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );
}


/*
 always build hls
*/
function buildHls(
  sourceUrl,
  origin
) {

  return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:36000
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:36000,
${origin}/seg?u=${encodeURIComponent(sourceUrl)}
#EXT-X-ENDLIST`;
}


export default {

  async fetch(request) {

    const url =
      new URL(
        request.url
      );


    /*
     segment endpoint
    */
    if (
      url.pathname ===
      "/seg"
    ) {

      const file =
        url.searchParams.get(
          "u"
        );

      return await proxyFile(
        file
      );
    }


    const path =
      url.pathname
        .replace("/", "");


    const quality =
      url
        .searchParams
        .get("q");


    const id =
      path
        .replace(".json", "")
        .replace(".m3u8", "")
        .replace(".mp4", "");


    const meta =
      await loadMeta(
        id
      );


    const selected =
      getBest(
        meta.videos,
        quality
      );


    /*
     json
    */
    if (
      path.endsWith(
        ".json"
      )
    ) {

      return Response.json({

        id,

        title:
          meta.movie
            ?.title,

        source:
          selected.url,

        qualities:
          meta.videos.map(
            x => x.name
          )
      });
    }


    /*
     m3u8 ALWAYS TEXT
    */
    if (
      path.endsWith(
        ".m3u8"
      )
    ) {

      const body =
        buildHls(
          selected.url,
          url.origin
        );

      return new Response(
        body,
        {
          headers: {

            "Content-Type":
              "text/plain",

            "Cache-Control":
              "no-cache"
          }
        }
      );
    }


    /*
     mp4 redirect
    */
    return Response.redirect(
      selected.url,
      302
    );
  }
}
