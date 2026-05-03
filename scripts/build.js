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
    line.split("|");


  m3u +=
`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}
${worker}/${id}.m3u8

`;
}


fs.mkdirSync(
  "playlist",
  {
    recursive: true
  }
);


fs.writeFileSync(
  "playlist/index.m3u",
  m3u
);
