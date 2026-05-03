function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}


/*
 quality selector
*/
function getBest(
  videos,
  quality
) {

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


/*
 okru metadata
*/
async function loadMeta(
  id
) {

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


  if (!match) {

    throw new Error(
      "metadata"
    );
  }


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
 Android range support
*/
async function proxyFile(
  fileUrl,
  request
) {

  const inHeaders = {

    "User-Agent":
      "Mozilla/5.0"
  };


  const range =
    request.headers.get(
      "range"
    );


  if (range) {

    inHeaders[
      "Range"
    ] = range;
  }


  const upstream =
    await fetch(
      fileUrl,
      {
        headers:
          inHeaders
      }
    );


  const out =
    new Headers();


  const pass =
    [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges"
    ];


  for (
    const key
    of pass
  ) {

    const value =
      upstream.headers.get(
        key
      );

    if (value) {

      out.set(
        key,
        value
      );
    }
  }


  out.set(
    "Access-Control-Allow-Origin",
    "*"
  );


  return new Response(
    upstream.body,
    {
      status:
        upstream.status,

      headers:
        out
    }
  );
}


/*
 fake HLS from mp4
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

  async fetch(
    request
  ) {

    try {

      const url =
        new URL(
          request.url
        );


      /*
       debug
      */
      if (
        url.pathname ===
        "/debug"
      ) {

        return new Response(
          "OKRU ANDROID V1"
        );
      }


      /*
       segment
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
          file,
          request
        );
      }


      const quality =
        url
          .searchParams
          .get("q");


      const path =
        url.pathname
          .replace("/", "");


      const id =
        path
          .replace(
            ".json",
            ""
          )
          .replace(
            ".m3u8",
            ""
          )
          .replace(
            ".mp4",
            ""
          );


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

          qualities:
            meta.videos.map(
              x => x.name
            ),

          source:
            selected.url
        });
      }


      /*
       hls
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
    catch (
      e
    ) {

      return new Response(
        e.message,
        {
          status: 500
        }
      );
    }
  }
}
