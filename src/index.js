function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}


function getBest(videos, quality) {

  if (quality) {

    const direct =
      videos.find(
        v =>
          v.name
            .toLowerCase() ===
          quality
            .toLowerCase()
      );

    if (direct) {
      return direct;
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


  const options =
    JSON.parse(
      decodeHtml(
        match[1]
      )
    );


  return JSON.parse(
    options.flashvars.metadata
  );
}


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
      status:
        upstream.status,

      headers:{
        "Content-Type":
          upstream.headers.get("content-type")
          || "video/mp4",

        "Content-Length":
          upstream.headers.get("content-length")
          || "",

        "Accept-Ranges":
          "bytes",

        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );
}


async function proxyManifest(
  sourceUrl,
  origin
){

  /*
   mp4 ise single file hls üret
  */

  if(
    !sourceUrl.includes(
      ".m3u8"
    )
  ){

    const body =
`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:36000
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:36000,
/seg?u=${encodeURIComponent(sourceUrl)}
#EXT-X-ENDLIST`;

    return new Response(
      body,
      {
        headers:{
          "Content-Type":
            "application/vnd.apple.mpegurl"
        }
      }
    );
  }


  /*
   gerçek hls ise proxy
  */

  const upstream =
    await fetch(
      sourceUrl
    );

  let manifest =
    await upstream.text();

  const base =
    sourceUrl.substring(
      0,
      sourceUrl.lastIndexOf("/") + 1
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
          "application/vnd.apple.mpegurl"
      }
    }
  );
}


export default {

  async fetch(request){

    const url =
      new URL(
        request.url
      );


    if(
      url.pathname ===
      "/seg"
    ){

      return await proxyFile(
        url.searchParams.get("u")
      );
    }


    const quality =
      url.searchParams.get(
        "q"
      );


    const path =
      url.pathname
        .replace("/", "");


    const id =
      path
        .replace(".json","")
        .replace(".m3u8","")
        .replace(".mp4","");


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
          meta.movie?.title,

        qualities:
          meta.videos.map(
            x => x.name
          ),

        source:
          selected.url
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
}
