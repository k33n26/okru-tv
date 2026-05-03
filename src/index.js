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


/*
 segment proxy
*/
async function proxyFile(
  fileUrl
){

  const upstream =
    await fetch(
      fileUrl,
      {
        headers:{
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    );

  return new Response(
    upstream.body,
    {
      headers:{
        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );
}


/*
 manifest proxy
*/
async function proxyManifest(
  manifestUrl,
  origin
){

  const upstream =
    await fetch(
      manifestUrl,
      {
        headers:{
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    );

  let manifest =
    await upstream.text();

  const base =
    manifestUrl.substring(
      0,
      manifestUrl.lastIndexOf("/") + 1
    );

  manifest =
    manifest.replace(
      /^([^#].+)$/gm,
      line => {

        if(
          line.startsWith("#")
        ){
          return line;
        }

        let full =
          line;

        if(
          !line.startsWith(
            "http"
          )
        ){
          full =
            base + line;
        }

        return `${origin}/seg?u=${encodeURIComponent(full)}`;
      }
    );

  return new Response(
    manifest,
    {
      headers:{
        "Content-Type":
          "application/vnd.apple.mpegurl",

        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );
}


export default {

  async fetch(request) {

    try {

      const url =
        new URL(
          request.url
        );


      /*
       segment
      */
      if(
        url.pathname ===
        "/seg"
      ){

        const file =
          url.searchParams.get(
            "u"
          );

        return await proxyFile(
          file
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
          .replace(".mp4","")
          .replace(".m3u8","")
          .replace(".json","");

      const meta =
        await loadMeta(
          id
        );

      const selected =
        getBest(
          meta.videos,
          quality
        );


      if(
        path.endsWith(
          ".json"
        )
      ){

        return Response.json({
          id,
          title:
            meta.movie
              ?.title
        });
      }


      if(
        path.endsWith(
          ".m3u8"
        )
      ){

        return await proxyManifest(
          selected.url,
          url.origin
        );
      }


      return Response.redirect(
        selected.url,
        302
      );

    }
    catch(e){

      return new Response(
        e.message,
        {
          status:500
        }
      );
    }
  }
}
