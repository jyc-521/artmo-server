import asyncHandler from "../utils/asyncHandler";
import HttpError from "../utils/httpError";
import { booleanField, httpsUrlField, numericId, objectBody, textField } from "../utils/input";
import * as sponsorships from "../services/sponsorships.service";

export const create = asyncHandler(async (req, res) => {
  const body = objectBody(req.body);
  if (body.licenseAgreed !== true) throw new HttpError(400, "필수 이용 동의에 체크해야 신청할 수 있습니다.");
  const created = await sponsorships.createSponsorship(req.auth!.id, {
    title: textField(body.title, "title", { required: true, max: 200 }),
    artist_name: textField(body.artistName, "artistName", { required: true, max: 100 }),
    image_url: httpsUrlField(body.imageUrl, "imageUrl"),
    description: textField(body.description, "description", { max: 2000 }),
    license_agreed: true,
    goods_consent: booleanField(body.goodsConsent, "goodsConsent", false),
  });
  res.status(201).json({ data: created });
});

export const mine = asyncHandler(async (req, res) => {
  res.json({ data: await sponsorships.listMine(req.auth!.id) });
});

export const list = asyncHandler(async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && status !== "pending" && status !== "approved" && status !== "rejected")
    throw new HttpError(400, "status 값이 올바르지 않습니다.");
  res.json({ data: await sponsorships.listAll(status) });
});

export const approve = asyncHandler(async (req, res) => {
  res.json({ data: await sponsorships.approve(numericId(String(req.params.id)), req.auth!.id) });
});

export const reject = asyncHandler(async (req, res) => {
  res.json({ data: await sponsorships.reject(numericId(String(req.params.id)), req.auth!.id) });
});
