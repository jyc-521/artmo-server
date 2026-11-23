import asyncHandler from "../utils/asyncHandler";
import HttpError from "../utils/httpError";
import { objectBody, textField, uuid } from "../utils/input";
import * as users from "../services/users.service";

export const profile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await users.getProfile(req.auth!.id) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const body = objectBody(req.body);
  const patch: { name?: string; avatar?: string } = {};
  if (body.name !== undefined) patch.name = textField(body.name, "name", { required: true, max: 80 });
  if (body.avatar !== undefined) patch.avatar = textField(body.avatar, "avatar", { max: 1000 });
  if (!Object.keys(patch).length) throw new HttpError(400, "바꿀 이름이나 이미지를 입력하세요.");
  res.json({ success: true, data: await users.updateProfile(req.auth!.id, patch) });
});

export const deactivate = asyncHandler(async (req, res) => {
  await users.deactivate(req.auth!.id);
  res.json({ success: true, message: "계정을 비활성화했습니다." });
});

export const list = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await users.listAll() });
});

export const changeType = asyncHandler(async (req, res) => {
  const userId = uuid(String(req.params.userId), "사용자 ID");
  const body = objectBody(req.body);
  if (body.userType !== "user" && body.userType !== "admin") throw new HttpError(400, "userType은 user 또는 admin이어야 합니다.");
  res.json({ success: true, data: await users.changeType(userId, body.userType) });
});
