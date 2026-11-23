import type { RequestHandler } from "express";
import asyncHandler from "../utils/asyncHandler";
import HttpError from "../utils/httpError";
import { booleanField, httpsUrlField, numericId, objectBody, textField } from "../utils/input";
import { ALLOWED_TAGS, cleanTags } from "../services/ai.service";
import * as artworks from "../services/artworks.service";
import { fetchArtworkImage } from "../services/image.service";

const TAGS = new Set<string>(ALLOWED_TAGS);

function pageParams(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit) || 24, 1), 60);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

function tagsField(value: unknown): string[] {
  const tags = cleanTags(value);
  if (!tags.length) throw new HttpError(400, "emotionTags는 허용된 감정 태그 1~5개여야 합니다.");
  return tags;
}

export const list = asyncHandler(async (req, res) => {
  const tag = typeof req.query.tag === "string" && TAGS.has(req.query.tag) ? req.query.tag : undefined;
  res.json({ data: await artworks.listArtworks({ tag, ...pageParams(req.query) }) });
});

export const popular = asyncHandler(async (req, res) => {
  res.json({ data: await artworks.popularArtworks(pageParams(req.query).limit) });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ data: await artworks.getArtwork(numericId(String(req.params.id))) });
});

// 공유 카드용 이미지 전달. 숨김 작품은 getArtwork에서 404.
export const image = asyncHandler(async (req, res) => {
  const art = await artworks.getArtwork(numericId(String(req.params.id)));
  const { contentType, body } = await fetchArtworkImage(art.imageUrl);
  res.set({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(body);
});

export const tags: RequestHandler = (_req, res) => {
  res.json({ data: ALLOWED_TAGS });
};

export const create = asyncHandler(async (req, res) => {
  const body = objectBody(req.body);
  if (body.source !== "met" && body.source !== "aic") throw new HttpError(400, "source는 met 또는 aic여야 합니다.");
  if (body.isPublicDomain !== true) throw new HttpError(400, "퍼블릭 도메인 작품만 등록할 수 있습니다.");
  const created = await artworks.createArtwork({
    source: body.source,
    source_id: textField(body.sourceId, "sourceId", { required: true, max: 50 }),
    title: textField(body.title, "title", { required: true, max: 300 }),
    artist: textField(body.artist, "artist", { max: 200 }) || "작자 미상",
    year: textField(body.year, "year", { max: 50 }),
    medium: textField(body.medium, "medium", { max: 200 }),
    image_url: httpsUrlField(body.imageUrl, "imageUrl"),
    source_url: body.sourceUrl ? httpsUrlField(body.sourceUrl, "sourceUrl") : "",
    emotion_tags: tagsField(body.emotionTags),
    description: textField(body.description, "description", { max: 2000 }),
    is_public_domain: true,
  });
  res.status(201).json({ data: created });
});

export const update = asyncHandler(async (req, res) => {
  const id = numericId(String(req.params.id));
  const body = objectBody(req.body);
  const patch: Parameters<typeof artworks.updateArtwork>[1] = {};
  if (body.title !== undefined) patch.title = textField(body.title, "title", { required: true, max: 300 });
  if (body.artist !== undefined) patch.artist = textField(body.artist, "artist", { required: true, max: 200 });
  if (body.year !== undefined) patch.year = textField(body.year, "year", { max: 50 });
  if (body.description !== undefined) patch.description = textField(body.description, "description", { max: 2000 });
  if (body.emotionTags !== undefined) patch.emotion_tags = tagsField(body.emotionTags);
  if (body.isVisible !== undefined) patch.is_visible = booleanField(body.isVisible, "isVisible");
  if (!Object.keys(patch).length) throw new HttpError(400, "바꿀 값을 입력하세요.");
  res.json({ data: await artworks.updateArtwork(id, patch) });
});

export const remove = asyncHandler(async (req, res) => {
  await artworks.deleteArtwork(numericId(String(req.params.id)));
  res.status(204).end();
});

export const save = asyncHandler(async (req, res) => {
  await artworks.saveArtwork(req.auth!.id, numericId(String(req.params.id)));
  res.status(201).json({ data: { saved: true } });
});

export const unsave = asyncHandler(async (req, res) => {
  await artworks.unsaveArtwork(req.auth!.id, numericId(String(req.params.id)));
  res.status(204).end();
});

export const saved = asyncHandler(async (req, res) => {
  res.json({ data: await artworks.listSaved(req.auth!.id) });
});
