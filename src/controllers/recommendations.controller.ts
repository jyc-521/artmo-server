import asyncHandler from "../utils/asyncHandler";
import { objectBody, sentenceField, uuid } from "../utils/input";
import * as recommendations from "../services/recommendations.service";
import { SUPPORT_MESSAGE, SUPPORT_RESOURCES } from "../services/support.service";

export const create = asyncHandler(async (req, res) => {
  const sentence = sentenceField(objectBody(req.body).sentence);
  const result = await recommendations.createRecommendation(sentence, req.auth?.id);
  if ("needsSupport" in result) {
    res.status(200).json({ data: { needsSupport: true, needsMoreDetail: false, message: SUPPORT_MESSAGE, resources: SUPPORT_RESOURCES } });
    return;
  }
  if (result.needsMoreDetail) {
    res.status(200).json({ data: { needsMoreDetail: true, hint: result.hint } });
    return;
  }
  res.status(201).json({ data: { needsMoreDetail: false, ...result.recommendation } });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ data: await recommendations.getRecommendation(uuid(String(req.params.id), "추천 ID"), req.auth?.id) });
});

// 소유권: 요청자 ID(req.auth)로만 조회한다.
export const mine = asyncHandler(async (req, res) => {
  res.json({ data: await recommendations.listMine(req.auth!.id) });
});

export const share = asyncHandler(async (req, res) => {
  await recommendations.recordShare(uuid(String(req.params.id), "추천 ID"));
  res.status(204).end();
});
