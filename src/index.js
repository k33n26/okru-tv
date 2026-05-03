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
        headers:{
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
 real byte stream proxy
*/
async function proxyVideo(
  sourceUrl,
  request
){

  const headers = {

    "User-Agent":
      "Mozilla/5.0",

    "Referer":
      "https://ok.ru/"
  };


  const range =
    request.headers.get(
      "range"
    );


  if (range) {

    headers[
      "Range"
    ] = range;
  }


  const upstream =
    await fetch(
      sourceUrl,
      {
        headers
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


export default {

  async fetch(
    request
  ) {

    try {

      const url =
        new URL(
          request.url
        );


      if (
        url.pathname ===
        "/debug"
      ) {

        return new Response(
          "OKRU STREAM V1"
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
          .replace(".json", "")
          .replace(".mp4", "")
          .replace(".m3u8", "");


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
       mp4 + m3u8 both stream
      */
      return await proxyVideo(
        selected.url,
        request
      );

    }
    catch (
      e
    ) {

      return new Response(
        e.message,
        {
          status:500
        }
      );
    }
  }
}
