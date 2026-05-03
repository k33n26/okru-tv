import fs from "fs";

const worker =
  "https://okrutv.k33n26.workers.dev";


const lines =
  fs
    .readFileSync(
      "channels.txt",
      "utf8"
    )
    .split("\n")
    .filter(Boolean);


let m3u =
  "#EXTM3U\n";


for (const line of lines) {

  const [
    name,
    id,
    logo,
    group
  ] =
    line
      .split("|")
      .map(
        x =>
          x.trim()
      );


  m3u +=
`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}
${worker}/${id}.mp4

`;
}


fs.mkdirSync(
  "playlist",
  {
    recursive:true
  }
);


fs.writeFileSync(
  "playlist/index.m3u",
  m3u
);
