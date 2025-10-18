import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// 🌐 إعدادات عامة
const apiBase = "https://musicai.apihub.today/api/v1";
const fcmToken =
  "eqnTqlxMTSKQL5NQz6r5aP:APA91bHa3CvL5Nlcqx2yzqTDAeqxm_L_vIYxXqehkgmTsCXrV29eAak6_jqXv5v1mQrdw4BGMLXl_BFNrJ67Em0vmdr3hQPVAYF8kR7RDtTRHQ08F3jLRRI";

function getUserHeaders(deviceId, msgId) {
  const time = Date.now().toString();
  return {
    "user-agent": "NB Android/1.0.0",
    "content-type": "application/json",
    accept: "application/json",
    "x-platform": "android",
    "x-app-version": "1.0.0",
    "x-country": "ID",
    "accept-language": "id-ID",
    "x-client-timezone": "Asia/Jakarta",
    "x-device-id": deviceId,
    "x-request-id": msgId,
    "x-message-id": msgId,
    "x-request-time": time,
  };
}

// 🔹 إنشاء أو تسجيل مستخدم
async function registerUser(deviceId, msgId) {
  const headers = getUserHeaders(deviceId, msgId);
  const res = await axios.put(
    `${apiBase}/users`,
    { deviceId, fcmToken },
    { headers }
  );
  return res.data.id;
}

// 🔹 إنشاء أغنية
async function createSong({ userId, title, lyrics, mood, genre, gender }, deviceId, msgId) {
  const headers = { ...getUserHeaders(deviceId, msgId), "x-client-id": userId };
  const body = { type: "lyrics", name: title, lyrics };
  if (mood) body.mood = mood;
  if (genre) body.genre = genre;
  if (gender) body.gender = gender;

  const res = await axios.post(`${apiBase}/song/create`, body, { headers });
  return res.data.id;
}

// 🔹 التحقق من حالة الأغنية
async function checkSong(userId, songId, deviceId, msgId) {
  const headers = { ...getUserHeaders(deviceId, msgId), "x-client-id": userId };
  const res = await axios.get(`${apiBase}/song/user`, {
    headers,
    params: { userId, isFavorite: false, page: 1, searchText: "" },
  });
  return res.data.datas.find((s) => s.id === songId) || null;
}

// 🔹 POST /api/suno
router.post("/", async (req, res) => {
  const { title, lyrics, mood, type, gender } = req.body;
  if (!title || !lyrics)
    return res.status(400).json({ status: false, message: "الرجاء إرسال title و lyrics" });

  try {
    const deviceId = uuidv4();
    const msgId = uuidv4();

    const userId = await registerUser(deviceId, msgId);
    const songId = await createSong({ userId, title, lyrics, mood, genre: type, gender }, deviceId, msgId);

    // poll الأغنية حتى يتم توليد الرابط
    let found = null;
    while (!found?.url) {
      await new Promise((r) => setTimeout(r, 3000));
      found = await checkSong(userId, songId, deviceId, msgId);
    }

    res.json({
      status: true,
      song: {
        id: found.id,
        name: found.name,
        url: found.url,
        status: found.status,
        thumbnail: found.thumbnail_url,
      },
    });
  } catch (e) {
    res.status(500).json({ status: false, message: "حدث خطأ أثناء توليد الأغنية", error: e.message });
  }
});

// 🔹 GET /api/suno?prompt=...&type=...&mode=...&gender=...
router.get("/", async (req, res) => {
  const { prompt, type, mode, gender } = req.query;
  if (!prompt)
    return res.status(400).json({ status: false, message: "الرجاء إرسال prompt" });

  try {
    const deviceId = uuidv4();
    const msgId = uuidv4();

    const userId = await registerUser(deviceId, msgId);
    const songId = await createSong({ userId, title: prompt, lyrics: prompt, mood: mode, genre: type, gender }, deviceId, msgId);

    let found = null;
    while (!found?.url) {
      await new Promise((r) => setTimeout(r, 3000));
      found = await checkSong(userId, songId, deviceId, msgId);
    }

    res.json({
      status: true,
      song: {
        id: found.id,
        name: found.name,
        url: found.url,
        status: found.status,
        thumbnail: found.thumbnail_url,
      },
    });
  } catch (e) {
    res.status(500).json({ status: false, message: "حدث خطأ أثناء توليد الأغنية", error: e.message });
  }
});

export default router;
