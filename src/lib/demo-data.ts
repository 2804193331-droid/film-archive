import type { Album, Photo, Uploader } from "@/lib/types";

export const demoUsers: Uploader[] = [
  {
    id: "u_001",
    username: "sakura",
    displayName: "Sakura Lin",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "u_002",
    username: "grainwalker",
    displayName: "Grain Walker",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "u_003",
    username: "softfocus",
    displayName: "Soft Focus",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80"
  }
];

const photoSeeds = [
  ["p_001", "淮海路午后", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee", 1600, 2134, "Nikon FM2", "Nikon AI-S 50mm f/1.4", "Kodak Gold 200", "Kodak", "135", 200, "f/2.8", "1/250", "50mm", "上海", demoUsers[0], "a_001"],
  ["p_002", "雨后的站台", "https://images.unsplash.com/photo-1495567720989-cebdbdd97913", 1600, 2000, "Leica M6", "Summicron-M 35mm f/2", "Ilford HP5+", "Ilford", "135", 400, "f/4", "1/125", "35mm", "杭州", demoUsers[1], "a_002"],
  ["p_003", "海边黄昏", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e", 1600, 1067, "Hasselblad 500C/M", "Planar 80mm f/2.8", "Kodak Portra 400", "Kodak", "120", 400, "f/5.6", "1/60", "80mm", "厦门", demoUsers[2], "a_003"],
  ["p_004", "街角便利店", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429", 1600, 2400, "Contax T2", "Carl Zeiss Sonnar 38mm f/2.8", "Cinestill 800T", "Cinestill", "135", 800, "f/2.8", "1/60", "38mm", "东京", demoUsers[0], "a_001"],
  ["p_005", "山间晨雾", "https://images.unsplash.com/photo-1506744038136-46273834b3fb", 1600, 1067, "Pentax 67", "SMC Takumar 105mm f/2.4", "Fuji Pro 400H", "Fuji", "120", 400, "f/4", "1/125", "105mm", "京都", demoUsers[1], "a_002"],
  ["p_006", "窗边静物", "https://images.unsplash.com/photo-1469474968028-56623f02e42e", 1600, 2200, "Nikon Zf", "NIKKOR Z 40mm f/2", "Digital", "Digital", "digital", 200, "f/2", "1/500", "40mm", "成都", demoUsers[2], "a_003"],
  ["p_007", "桥下光斑", "https://images.unsplash.com/photo-1493246507139-91e8fad9978e", 1600, 2134, "Canon AE-1", "FD 50mm f/1.4", "Kodak ColorPlus 200", "Kodak", "135", 200, "f/1.8", "1/500", "50mm", "广州", demoUsers[0], "a_001"],
  ["p_008", "夜色霓虹", "https://images.unsplash.com/photo-1518837695005-2083093ee35b", 1600, 1067, "Canon EOS 1V", "EF 50mm f/1.2L", "Cinestill 800T", "Cinestill", "135", 800, "f/1.2", "1/125", "50mm", "香港", demoUsers[1], "a_002"],
  ["p_009", "树影与墙", "https://images.unsplash.com/photo-1519681393784-d120267933ba", 1600, 2100, "Olympus OM-1", "Zuiko 50mm f/1.8", "Fomapan 200", "Fomapan", "135", 200, "f/8", "1/250", "50mm", "南京", demoUsers[2], "a_003"]
] as const;

export const demoPhotos: Photo[] = photoSeeds.map((seed, index) => {
  const [
    id,
    title,
    url,
    width,
    height,
    camera,
    lens,
    film,
    filmBrand,
    cameraType,
    iso,
    aperture,
    shutter,
    focalLength,
    location,
    uploader,
    albumId
  ] = seed;

  const imageUrl = `${url}?auto=format&fit=crop&w=1400&q=82`;

  return {
    id,
    userId: uploader.id,
    albumId,
    title,
    description: "一张按胶片档案方式整理的示例作品。",
    thumbnailUrl: `${url}?auto=format&fit=crop&w=760&q=78`,
    previewUrl: imageUrl,
    originalUrl: `${url}?auto=format&fit=max&w=2400&q=92`,
    width,
    height,
    camera,
    cameraType: cameraType as Photo["cameraType"],
    lens,
    film,
    filmBrand,
    iso,
    aperture,
    shutter,
    focalLength,
    takenAt: `202${index % 4 + 1}-${String((index % 9) + 1).padStart(2, "0")}-${String((index % 23) + 4).padStart(2, "0")}`,
    location,
    scanner: index % 3 === 0 ? "Nikon Coolscan V ED" : "Noritsu HS-1800",
    notes: "保留颗粒、轻微校色，未做大幅裁切。",
    uploader,
    visibility: "public",
    createdAt: new Date(Date.now() - index * 86400000).toISOString()
  };
});

export const demoAlbums: Album[] = [
  {
    id: "a_001",
    userId: demoUsers[0].id,
    title: "Kodak Gold 200 上海街头",
    description: "从午后到傍晚的城市切片。",
    coverUrl: demoPhotos[0].thumbnailUrl,
    coverWidth: demoPhotos[0].width,
    coverHeight: demoPhotos[0].height,
    photoCount: 3,
    photoIds: ["p_001", "p_004", "p_007"],
    camera: "Nikon FM2",
    cameraType: "135",
    lens: "Nikon AI-S 50mm f/1.4",
    film: "Kodak Gold 200",
    filmBrand: "Kodak",
    iso: 200,
    date: "2024-05",
    location: "上海",
    owner: demoUsers[0],
    visibility: "public",
    createdAt: demoPhotos[0].createdAt
  },
  {
    id: "a_002",
    userId: demoUsers[1].id,
    title: "雨天与夜色",
    description: "高感胶片、雨水反光和城市灯牌组成的一组夜间档案。",
    coverUrl: demoPhotos[1].thumbnailUrl,
    coverWidth: demoPhotos[1].width,
    coverHeight: demoPhotos[1].height,
    photoCount: 3,
    photoIds: ["p_002", "p_005", "p_008"],
    camera: "Leica M6",
    cameraType: "135",
    lens: "Summicron-M 35mm f/2",
    film: "Ilford HP5+",
    filmBrand: "Ilford",
    iso: 400,
    date: "2023-11",
    location: "杭州 / 香港 / 京都",
    owner: demoUsers[1],
    visibility: "public",
    createdAt: demoPhotos[1].createdAt
  },
  {
    id: "a_003",
    userId: demoUsers[2].id,
    title: "低饱和的安静时刻",
    description: "室内、山野与冬日空间里，关于柔和光线的一组记录。",
    coverUrl: demoPhotos[2].thumbnailUrl,
    coverWidth: demoPhotos[2].width,
    coverHeight: demoPhotos[2].height,
    photoCount: 3,
    photoIds: ["p_003", "p_006", "p_009"],
    camera: "Hasselblad 500C/M",
    cameraType: "120",
    lens: "Planar 80mm f/2.8",
    film: "Kodak Portra 400",
    filmBrand: "Kodak",
    iso: 400,
    date: "2022-12",
    location: "厦门 / 成都 / 南京",
    owner: demoUsers[2],
    visibility: "public",
    createdAt: demoPhotos[2].createdAt
  }
];

export const demoSeries = demoAlbums;
