function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

function getBest(videos, quality) {

  const order = {
    "1080": ["full", "1080"],
    "720": ["hd", "720"],
    "480": ["sd", "480"],
    "360": ["lowest", "mobile"]
  };

  if (quality) {

    const wanted =
      order[quality] || [];

    for (const q of wanted) {

      const found =
        videos.find(
          v =>
            v.name
              .toLowerCase()
              === q
        );

      if (found) {
        return found;
      }
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


export default {

  async fetch(request) {

    try {

      const url =
        new URL(
          request.url
        );

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
            ".mp4",
            ""
          )
          .replace(
            ".m3u8",
            ""
          )
          .replace(
            ".json",
            ""
          );

      const meta =
        await loadMeta(
          id
        );

      const videos =
        meta.videos;

      const selected =
        getBest(
          videos,
          quality
        );

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
            videos.map(
              x =>
                x.name
            )
        });
      }


      if (
        path.endsWith(
          ".m3u8"
        )
      ) {

        const body =
`#EXTM3U
#EXTINF:-1,${meta.movie?.title || id}
${selected.url}`;

        return new Response(
          body,
          {
            headers: {
              "Content-Type":
                "application/vnd.apple.mpegurl"
            }
          }
        );
      }

      return Response.redirect(
        selected.url,
        302
      );

    }
    catch (e) {

      return new Response(
        e.message,
        {
          status: 500
        }
      );
    }
  }
}
