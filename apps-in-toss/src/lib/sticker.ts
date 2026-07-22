import { removeBackground, preload } from "@imgly/background-removal";

// 1) 배경 제거(누끼) → 투명 PNG Blob
// 2) 흰색 다이컷 테두리 둘러서 "스티커" 느낌 → 최종 PNG Blob
//
// 전부 브라우저에서 실행됨. 사진이 서버로 나가지 않고, 비용도 0원.
// 첫 실행 때 세그멘테이션 모델(WASM)을 한 번 받고, 이후엔 캐시됨.

// fp16 모델: 품질/속도 균형. 모바일에서도 무난.
const MODEL = "isnet_fp16" as const;
// 큰 폰 사진을 미리 이 크기로 줄여서 처리 → 디코딩/메모리 부담↓ (품질 영향 거의 없음)
const INPUT_MAX = 1536;

export interface StickerOptions {
  borderWidth?: number; // 흰 테두리 두께(px). 기본 12
  onProgress?: (phase: "download" | "process", ratio: number) => void;
}

// cutout = 테두리 없는 투명 컷아웃(편집용 원본), sticker = 흰 테두리 스티커(표시용)
export interface StickerPair {
  cutout: Blob;
  sticker: Blob;
}

export const DEFAULT_BORDER = 12;

let preloadPromise: Promise<void> | null = null;

/** 세그멘테이션 모델을 미리 받아둔다(워밍업). 추가 화면 열 때 호출 → 첫 누끼가 빨라짐 */
export function preloadSticker(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = preload({ model: MODEL }).catch(() => {
      preloadPromise = null; // 실패 시 다음에 재시도 가능
    });
  }
  return preloadPromise;
}

// 저장(업로드)용 컷아웃 최대 크기 — 화면엔 작게 표시되므로 이 정도면 충분.
// 흰 테두리는 표시할 때 CSS(.cutout)로 그리므로 굽지 않는다(업로드 1개로 절반).
const OUTPUT_MAX = 1080;

/** 원본 File → 테두리 없는 투명 컷아웃 Blob(표시/편집 공용) */
export async function makeSticker(
  file: File | Blob,
  opts: StickerOptions = {},
): Promise<StickerPair> {
  const input = await downscale(file, INPUT_MAX);
  const raw = await removeBackground(input, {
    model: MODEL,
    output: { format: "image/png", quality: 0.9 },
    progress: (key, current, total) => {
      const ratio = total ? current / total : 0;
      if (key.startsWith("fetch")) opts.onProgress?.("download", ratio);
      else opts.onProgress?.("process", ratio);
    },
  });

  // 1차: 투명 여백 자동 트림 (이후 더 필요하면 누끼 편집에서 수동 크롭)
  const trimmed = await trimTransparent(raw);
  // 업로드 가볍게: 컷아웃을 표시 크기에 맞게 축소(투명 PNG 유지)
  const cutout = await downscalePng(trimmed, OUTPUT_MAX);
  // sticker 자리도 같은 컷아웃(별도 테두리 파일 안 만듦)
  return { cutout, sticker: cutout };
}

/** 투명 여백을 잘라내 옷의 실제 바운딩박스에 맞춤 (약간의 여백 pad 유지) */
export async function trimTransparent(blob: Blob, pad = 8): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1;
    const ALPHA = 12; // 이 값보다 불투명하면 '옷'으로 간주
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > ALPHA) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return blob; // 전부 투명이면 원본
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    if (cw >= w && ch >= h) return blob; // 자를 게 없음
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d")!.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return await new Promise<Blob>((r) =>
      out.toBlob((b) => r(b ?? blob), "image/png"),
    );
  } catch {
    return blob;
  }
}

/** 투명 PNG를 maxDim 이하로 축소 (알파 유지, PNG로 출력) */
async function downscalePng(source: Blob, maxDim: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(source);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (scale >= 1) {
      bmp.close();
      return source;
    }
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? source), "image/png"),
    );
  } catch {
    return source;
  }
}

/** 이미지 최대 변을 maxDim 이하로 축소 (작으면 원본 그대로) */
async function downscale(source: File | Blob, maxDim: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(source);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (scale >= 1) {
      bmp.close();
      return source;
    }
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob(
        (b) => resolve(b ?? source),
        "image/jpeg",
        0.92,
      ),
    );
  } catch {
    return source; // 축소 실패해도 원본으로 진행
  }
}

/** 투명 PNG에 alpha 외곽선을 따라 흰색 다이컷 테두리를 추가 */
export async function addDieCutBorder(
  transparentPng: Blob,
  borderWidth = 12,
): Promise<Blob> {
  const img = await blobToImage(transparentPng);
  const pad = borderWidth + 4;
  const w = img.naturalWidth + pad * 2;
  const h = img.naturalHeight + pad * 2;

  // 흰색 실루엣(원본 alpha 모양을 흰색으로 채운 것)을 먼저 만든다
  const sil = document.createElement("canvas");
  sil.width = w;
  sil.height = h;
  const sctx = sil.getContext("2d")!;
  sctx.drawImage(img, pad, pad);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, w, h);

  // 실루엣을 원형으로 여러 번 찍어 테두리를 부풀린다(dilate)
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  const steps = 32;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(
      sil,
      Math.cos(a) * borderWidth,
      Math.sin(a) * borderWidth,
    );
  }
  // 살짝의 부드러운 그림자로 스티커가 떠 보이게
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(sil, 0, 0); // 그림자용 한 번 더
  ctx.shadowColor = "transparent";

  // 마지막으로 원본 컷아웃을 위에 얹는다
  ctx.drawImage(img, pad, pad);

  return canvasToBlob(out);
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob 실패"))),
      "image/png",
    );
  });
}
